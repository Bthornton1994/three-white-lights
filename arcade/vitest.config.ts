import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/sport/**/*.test.ts", "src/game/a0LiftFreeze.test.ts"],
  },
});
