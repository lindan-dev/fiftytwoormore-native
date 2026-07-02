-- push_tokens: stores Expo push notification tokens per user/device.
-- One user can have multiple tokens (multiple devices). A token is
-- unique across the table (re-registering the same device updates its
-- row rather than creating a duplicate).

CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type text, -- 'ios' | 'android'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_id_idx ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see, register, update, and remove their own tokens.
-- Sending pushes happens server-side (edge function using the service
-- role key), which bypasses RLS entirely - these policies only govern
-- what the client app itself can do.
CREATE POLICY "Users can view their own push tokens"
ON public.push_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
ON public.push_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
ON public.push_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
ON public.push_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Keep updated_at current on re-registration (e.g. token refreshed by Expo/APNs).
CREATE OR REPLACE FUNCTION public.set_push_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_tokens_set_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.set_push_tokens_updated_at();
