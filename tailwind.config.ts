import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12211a",
        moss: "#2f6b4f",
        mossLight: "#e7f1ec",
        sand: "#f7f6f2",
      },
    },
  },
  plugins: [],
};

export default config;
