import { defineConfig, mergeConfig } from "jest";
import baseConfig from "../../jest.config.ts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    roots: ["<rootDir>/src"],
    moduleNameMapper: {
      "^@alchemist-software/cache-kit$": "<rootDir>/../core/src/index.ts",
    },
  }),
);
