// Ported 1:1 from fiftytwoormore's web app (src/index.css light theme).
// Used with StyleSheet.create() instead of Tailwind classNames.
export const colors = {
  background: "hsl(30, 35%, 92%)",
  foreground: "hsl(10, 15%, 15%)",

  card: "hsl(0, 0%, 100%)",
  cardForeground: "hsl(10, 15%, 15%)",

  popover: "hsl(0, 0%, 100%)",
  popoverForeground: "hsl(10, 15%, 15%)",

  primary: "hsl(10, 80%, 65%)",
  primaryForeground: "hsl(0, 0%, 100%)",

  secondary: "hsl(10, 60%, 75%)",
  secondaryForeground: "hsl(0, 0%, 100%)",

  muted: "hsl(30, 25%, 88%)",
  mutedForeground: "hsl(10, 10%, 45%)",

  accent: "hsl(10, 75%, 70%)",
  accentForeground: "hsl(0, 0%, 100%)",

  destructive: "hsl(0, 84.2%, 60.2%)",
  destructiveForeground: "hsl(0, 0%, 100%)",

  border: "hsl(30, 20%, 85%)",
  input: "hsl(30, 15%, 90%)",
  ring: "hsl(10, 80%, 65%)",

  chart1: "hsl(10, 80%, 65%)",
  chart2: "hsl(280, 65%, 60%)",
  chart3: "hsl(340, 75%, 65%)",
  chart4: "hsl(45, 90%, 60%)",
  chart5: "hsl(160, 60%, 50%)",
} as const;

export const radius = {
  lg: 16, // matches --radius: 1rem
  md: 14,
  sm: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
