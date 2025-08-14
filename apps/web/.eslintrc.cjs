module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: { ecmaFeatures: { jsx: true } },
    plugins: ["@typescript-eslint"],
    extends: [
      "next/core-web-vitals",
      "plugin:@typescript-eslint/recommended",
      "plugin:prettier/recommended"
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    },
    ignorePatterns: ["node_modules/", ".next/", "out/"]
  };
  