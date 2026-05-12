import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        "surface-alt": "var(--surface-alt)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        accent: "var(--accent)",
        "accent-light": "var(--accent-light)",
        "accent-subtle": "var(--accent-subtle)",
        "accent-muted": "var(--accent-muted)",
        highlight: "var(--highlight)",
        listening: "var(--listening)",
        error: "var(--error)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["'SF Mono'", "'Fira Code'", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
