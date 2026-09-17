import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// importing wasp/server (for HttpError) eagerly validates process.env against
// Wasp's full server env schema (DATABASE_URL, SENDGRID_API_KEY, etc.) even
// though these unit tests never touch a database or send an email --
// loading .env.server satisfies that validation without a live DB/services.
dotenv.config({ path: ".env.server" });
process.env.NODE_ENV = "development";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
