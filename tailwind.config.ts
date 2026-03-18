import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "neural-bg": "#030014",
        "neural-cyan": "#00d4ff",
        "neural-purple": "#7c3aed",
        "neural-green": "#22c55e",
        "neural-surface": "#0d0d2b",
        "neural-border": "#1a1a4e",
        "neural-muted": "#6b7280",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "blink": "blink 1s step-end infinite",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "blink": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
    },
  },
  plugins: [],
};
export default config;
