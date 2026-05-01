/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
      },
      colors: {
        brutal: {
          yellow: "#FFE600",
          cyan: "#00E5FF",
          pink: "#FF4D6D",
          green: "#00C853",
          black: "#000000",
          white: "#FFFFFF",
          gray: "#E2E8F0",
        },
        border: "hsl(0 0% 0%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 0%)",
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px rgba(0,0,0,1)",
        "brutal-sm": "2px 2px 0px 0px rgba(0,0,0,1)",
        "brutal-lg": "8px 8px 0px 0px rgba(0,0,0,1)",
        "brutal-xl": "12px 12px 0px 0px rgba(0,0,0,1)",
      },
      borderRadius: {
        lg: "4px",
        md: "2px",
        sm: "0px",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
      },
      animation: {
        wiggle: "wiggle 0.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
