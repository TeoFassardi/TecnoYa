import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";
export function createAuth(uri: string, secret: string, url: string) {
  const client = new MongoClient(uri);
  const auth = betterAuth({
    appName: "TecnoYa",
    secret,
    baseURL: url,
    database: mongodbAdapter(client.db(), { client }),
    trustedOrigins: [url],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
    session: { cookieCache: { enabled: false } },
  });
  return { auth, client };
}
export type Auth = ReturnType<typeof createAuth>["auth"];
