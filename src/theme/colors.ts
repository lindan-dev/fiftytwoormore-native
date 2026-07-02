// Ported 1:1 from fiftytwoormore's web app (src/index.css light theme).
// Used with StyleSheet.create() instead of Tailwind classNames.
//
// IMPORTANT: values are hex, not hsl(...) strings. Many components build
// translucent variants by string-concatenating a hex alpha suffix, e.g.
// `colors.primary + "33"`. That only produces a valid color when the base
// is hex (#RRGGBB + AA = #RRGGBBAA) - concatenating onto an hsl(...)
// string produces an invalid, silently-broken color. Keep these as hex.
export const colors = {
  background: "#F2EBE3",
  foreground: "#2C2221",

  card: "#FFFFFF",
  cardForeground: "#2C2221",

  popover: "#FFFFFF",
  popoverForeground: "#2C2221",

  primary: "#ED765E",
  primaryForeground: "#FFFFFF",

  secondary: "#E6A699",
  secondaryForeground: "#FFFFFF",

  muted: "#E8E0D9",
  mutedForeground: "#7E6B67",

  accent: "#EC8C79",
  accentForeground: "#FFFFFF",

  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",

  border: "#E0D9D1",
  input: "#E9E6E2",
  ring: "#ED765E",

  chart1: "#ED765E",
  chart2: "#AF57DB",
  chart3: "#E9638F",
  chart4: "#F5C73D",
  chart5: "#33CC99",
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
