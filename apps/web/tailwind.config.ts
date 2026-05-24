import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101923",
        mist: "#edf3f7",
        sand: "#f8f3ea",
        amber: "#f3b93f",
        teal: "#12747c",
        coral: "#f27059",
        pine: "#1f5f4a"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(16, 25, 35, 0.08)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(16,25,35,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,25,35,0.05) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;

