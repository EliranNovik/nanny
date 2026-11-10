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
        /** Go live / Post request CTAs: scale only (no colored glow). */
        "dock-primary-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.92)" },
        },
        /** Discover dock white “More” FAB — soft ring pulse */
        "dock-more-fab-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(148, 163, 184, 0)",
          },
          "50%": {
            boxShadow: "0 0 22px 7px rgba(148, 163, 184, 0.38)",
          },
        },
        /** Bottom nav center “+” — soft shadow pulse */
        "dock-plus-glow": {
          "0%, 100%": {
            boxShadow: "0 4px 14px -4px rgba(0, 0, 0, 0.12)",
          },
          "50%": {
            boxShadow: "0 10px 28px -2px rgba(0, 0, 0, 0.38)",
          },
        },
        /** Discover strip avatar live dot — inner element scales (outer holds translate). */
        "strip-live-dot-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.82)" },
        },
        /** Chat typing bubble: pops in from its tail corner. */
        "typing-bubble-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.55)" },
          "60%": { opacity: "1", transform: "translateY(-1px) scale(1.04)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "typing-bubble-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.6)" },
        },
        /** Chat typing dots: staggered wave. */
        "typing-dot-wave": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        /** Chat typing bubble: slow breathe while waiting. */
        "typing-bubble-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.035)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "dock-primary-breathe":
          "dock-primary-breathe 2.25s ease-in-out infinite",
        "dock-more-fab-glow":
          "dock-more-fab-glow 3.5s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "dock-plus-glow":
          "dock-plus-glow 3.5s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "strip-live-dot-breathe":
          "strip-live-dot-breathe 1.75s ease-in-out infinite",
        "typing-bubble-in":
          "typing-bubble-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "typing-bubble-out": "typing-bubble-out 0.18s ease-in both",
        "typing-dot-wave": "typing-dot-wave 1.2s ease-in-out infinite",
        "typing-bubble-breathe":
          "typing-bubble-breathe 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

