/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
      },
      boxShadow: {
        aurora: "0 0 80px rgba(86, 145, 255, 0.26)",
        ember: "0 0 48px rgba(246, 190, 122, 0.22)",
        glass: "0 24px 80px rgba(4, 8, 28, 0.45)",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.55", transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { opacity: "0.95", transform: "translate3d(0, -12px, 0) scale(1.08)" },
        },
      },
      animation: {
        shimmer: "shimmer 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
