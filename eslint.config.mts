import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "**/assets/*.js",
      ".claude/**",
      "**/.#*",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-this-alias": "error",
      "no-unsafe-finally": "error",
      "no-cond-assign": "error",
      "no-fallthrough": "error",
      "no-sparse-arrays": "error",
      "no-prototype-builtins": "error",
      "no-constant-binary-expression": "error",
      "complexity": ["error", 2]
    },
  },
  {
    files: ["**/*.json", "**/*.jsonc", "**/*.json5"],
    plugins: { json },
    language: "json/json",
    rules: {
      "json/no-duplicate-keys": "error"
    },
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    rules: {
      "markdown/fenced-code-language": "error",
    },
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    rules: {
      "css/no-invalid-properties": "error",
    },
  },
);
