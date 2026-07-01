/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Ported 1:1 from fiftytwoormore's web app (src/index.css light theme).
        // Static values instead of CSS vars, since React Native has no
        // concept of runtime CSS custom properties.
        background: "hsl(30 35% 92%)",
        foreground: "hsl(10 15% 15%)",

        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(10 15% 15%)",

        popover: "hsl(0 0% 100%)",
        "popover-foreground": "hsl(10 15% 15%)",

        primary: {
          DEFAULT: "hsl(10 80% 65%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(10 60% 75%)",
          foreground: "hsl(0 0% 100%)",
        },
        muted: {
          DEFAULT: "hsl(30 25% 88%)",
          foreground: "hsl(10 10% 45%)",
        },
        accent: {
          DEFAULT: "hsl(10 75% 70%)",
          foreground: "hsl(0 0% 100%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(0 0% 100%)",
        },

        border: "hsl(30 20% 85%)",
        input: "hsl(30 15% 90%)",
        ring: "hsl(10 80% 65%)",

        // Chart palette, ported from --chart-1..5
        chart: {
          1: "hsl(10 80% 65%)",
          2: "hsl(280 65% 60%)",
          3: "hsl(340 75% 65%)",
          4: "hsl(45 90% 60%)",
          5: "hsl(160 60% 50%)",
        },
      },
      borderRadius: {
        lg: "16px", // matches --radius: 1rem
        md: "14px",
        sm: "12px",
      },
    },
  },
  plugins: [],
};
