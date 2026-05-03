/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
        "xs": "400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        /** Discover dock “Post live” shadow pulse — avoids ::before layering issues under opaque fills. */
        "dock-post-live-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(123, 97, 255, 0)",
          },
          "50%": {
            boxShadow: "0 0 26px 8px rgba(123, 97, 255, 0.42)",
          },
        },
        /** Discover dock “Go live” shadow pulse */
        "dock-go-live-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)",
          },
          "50%": {
            boxShadow: "0 0 26px 8px rgba(16, 185, 129, 0.45)",
          },
        },
        /** Discover strip avatar live dot — inner element scales (outer holds translate). */
        "strip-live-dot-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.82)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "dock-post-live-glow":
          "dock-post-live-glow 3.5s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "dock-go-live-glow":
          "dock-go-live-glow 3.5s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "strip-live-dot-breathe":
          "strip-live-dot-breathe 1.75s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

