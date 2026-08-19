import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, appetizing clay palette - shadows read against clayBase.
        clayBase: "#F4E9DC",
        claySurface: "#FBF3E8",
        ink: "#241B15",
        accent: "#FF6B4A",
        accentDeep: "#E5502F",
        gold: "#F2A93B",
        line: "#E7D9C4",
        warn: "#C23B1F",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        clay: "28px",
        "clay-sm": "18px",
      },
    },
  },
  plugins: [],
};

export default config;
