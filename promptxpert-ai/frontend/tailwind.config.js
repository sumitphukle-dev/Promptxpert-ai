/** Darkroom palette: ink base, lumen text; teal = real-like, magenta = AI-like, amber = inconclusive. */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080A12", panel: "#10131F", raised: "#171B2B", line: "#242A40",
        lumen: "#EDF1FF", dim: "#98A2C3", iris: "#8F83FF",
        real: "#3DDDB4", fake: "#FF5A8F", warn: "#FFC65C",
      },
      fontFamily: { display: ["var(--font-display)", "system-ui", "sans-serif"], sans: ["var(--font-body)", "system-ui", "sans-serif"] },
      keyframes: {
        beam: { "0%": { transform: "translateX(-10%)" }, "100%": { transform: "translateX(110%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: { beam: "beam 1.8s cubic-bezier(.5,0,.5,1) infinite", float: "float 6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
