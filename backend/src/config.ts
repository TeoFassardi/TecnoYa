import { z } from "zod";
export const config = z
  .object({
    MONGODB_URI: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .refine(
    (env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
    { message: "Configurá GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET juntos" },
  )
  .parse(process.env);
