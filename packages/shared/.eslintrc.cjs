module.exports = {
    root: true,
    env: { node: true, es2022: true },
    parser: "@typescript-eslint/parser",
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: ["@typescript-eslint"],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:prettier/recommended"
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    },
    ignorePatterns: ["dist/", "node_modules/"]
  };
  