import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    200: "#bae6fd",
                    300: "#7dd3fc",
                    400: "#38bdf8",
                    500: "#0ea5e9",
                    600: "#0284c7",
                    700: "#0369a1",
                    800: "#075985",
                    900: "#0c4a6e",
                },
                background: "#F2F2F7",
                surface: "rgba(255, 255, 255, 0.75)",
                "surface-hover": "rgba(255, 255, 255, 0.9)",
                "border-standard": "#f3f4f6",
            },
            borderRadius: {
                card: "16px",
                ios: "14px",
            },
            boxShadow: {
                card: "0 10px 30px rgba(15, 23, 42, 0.06), 0 2px 10px rgba(15, 23, 42, 0.04)",
                float: "0 18px 50px rgba(15, 23, 42, 0.12), 0 6px 18px rgba(15, 23, 42, 0.06)",
            },
        },
    },
    plugins: [],
};
export default config;
