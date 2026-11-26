import mongoose from "mongoose";
import { config } from "./config.js";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const { auth, client } = createAuth(
  config.MONGODB_URI,
  config.BETTER_AUTH_SECRET,
  config.BETTER_AUTH_URL,
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      }
    : undefined,
);
await client.connect();
const server = createApp(auth, config.BETTER_AUTH_URL).listen(
  config.PORT,
  "0.0.0.0",
  () => console.log(`TecnoYa escuchando en ${config.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void Promise.all([mongoose.disconnect(), client.close()]).then(() =>
        process.exit(0),
      );
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
