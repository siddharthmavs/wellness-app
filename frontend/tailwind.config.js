/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka"', "sans-serif"],
        body: ['"Nunito"', "sans-serif"],
        hand: ['"Kalam"', "cursive"],
      },
      colors: {
        cozy: {
          bg: "#EEF5E8",
          surface: "#FFFDF8",
          primary: "#7FAE62",
          "primary-dark": "#5B8A44",
          secondary: "#F7D9C4",
          accent: "#F2B5A7",
          text: "#3D4437",
          muted: "#7D8A74",
          border: "#D9E3D0",
        },
        // Legacy brutal palette — remapped to cozy tones so old class names still work
        brutal: {
          yellow: "#F7D9C4",
          cyan: "#C8DFF0",
          pink: "#F2B5A7",
          green: "#7FAE62",
          black: "#3D4437",
          white: "#FFFDF8",
          gray: "#EDF3E6",
        },
        border: "hsl(90 15% 82%)",
        background: "hsl(90 40% 93%)",
        foreground: "hsl(90 10% 24%)",
      },
      boxShadow: {
        cozy: "0px 4px 12px rgba(61, 68, 55, 0.08)",
        "cozy-lg": "0px 8px 20px rgba(61, 68, 55, 0.12)",
        // Legacy names — remapped to cozy shadows
        brutal: "0px 4px 12px rgba(61, 68, 55, 0.08)",
        "brutal-sm": "0px 2px 6px rgba(61, 68, 55, 0.06)",
        "brutal-lg": "0px 8px 20px rgba(61, 68, 55, 0.12)",
        "brutal-xl": "0px 12px 28px rgba(61, 68, 55, 0.16)",
      },
      borderRadius: {
        lg: "24px",
        md: "16px",
        sm: "12px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "94%, 98%": { transform: "scaleY(0.1)" },
        },
        sway: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        blink: "blink 5s ease-in-out infinite",
        sway: "sway 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
