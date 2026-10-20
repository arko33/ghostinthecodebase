import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e14",
        panel: "#111722",
        elev: "#161d2b",
        line: "#1f2937",
        dim: "#8b98a9",
        ai: "#f5a623",
        human: "#4aa8ff",
        danger: "#ff4d4f",
        ok: "#3fb950",
        accent: "#a371f7",
        glow: "#0d1117",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "8px" },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(163,113,247,0.35), 0 0 20px -4px rgba(163,113,247,0.4)",
        hot: "0 0 0 1px rgba(255,77,79,0.5), 0 0 24px -2px rgba(255,77,79,0.55)",
      },
      keyframes: {
        pulseGlow: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        pulseGlow: "pulseGlow 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
