import { z } from "zod";
export const config = z
  .object({
    MONGODB_URI: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .parse(process.env);
