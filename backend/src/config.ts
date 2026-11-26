import { z } from "zod";
export const config = z
  .object({
    MONGODB_URI: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    SUPABASE_URL: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional(),
    SUPABASE_SECRET_KEY: z.string().trim().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().trim().min(1).default("product-images"),
    GROQ_API_KEY: z.string().trim().optional(),
    GROQ_MODEL: z.string().trim().min(1).default("openai/gpt-oss-20b"),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .refine(
    (env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
    { message: "Configurá GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET juntos" },
  )
  .refine(
    (env) => Boolean(env.SUPABASE_URL) === Boolean(env.SUPABASE_SECRET_KEY),
    { message: "Configurá SUPABASE_URL y SUPABASE_SECRET_KEY juntos" },
  )
  .parse(process.env);
