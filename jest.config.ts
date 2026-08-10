import { defineConfig } from "jest";

export default defineConfig({
  testEnvironment: "jest-environment-node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(spec|test).ts", "**/?(*.)+(spec|test).ts"],
  moduleFileExtensions: ["js", "mjs", "ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.(t|m?j)s$": "@swc/jest",
  },
  transformIgnorePatterns: [],
  collectCoverage: false,
  coverageProvider: "v8",
  coverageReporters: ["html", "text", "text-summary"],
  maxWorkers: "50%",
});
