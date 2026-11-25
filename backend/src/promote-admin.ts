import { MongoClient } from "mongodb";
import { config } from "./config.js";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Uso: npm run admin -- correo@ejemplo.com");
const client = await new MongoClient(config.MONGODB_URI).connect();
try {
  const result = await client
    .db()
    .collection("user")
    .updateOne({ email }, { $set: { role: "admin", updatedAt: new Date() } });
  if (!result.matchedCount)
    throw new Error("Primero registrá esa cuenta en TecnoYa");
  console.log("Cuenta promovida a administrador");
} finally {
  await client.close();
}
