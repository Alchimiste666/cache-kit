import { defineConfig, mergeConfig } from "jest";
import baseConfig from "../../jest.config.ts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    roots: ["<rootDir>/src"],
  }),
);
