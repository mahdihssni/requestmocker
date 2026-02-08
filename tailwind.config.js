/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./options.html", "./src/**/*.{js,vue}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem"
      }
    }
  },
  plugins: []
};

