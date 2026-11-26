import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
import { Product } from "./product.js";
import SwaggerParser from "@apidevtools/swagger-parser";
import { ChatGroq } from "@langchain/groq";
import { buildCatalogAssistant } from "./catalog-assistant.js";
import type { ImageStorage } from "./image-storage.js";
import { randomUUID } from "node:crypto";
let mongo: MongoMemoryReplSet;
let authBundle: ReturnType<typeof createAuth>;
let app: ReturnType<typeof createApp>;
const origin = "http://localhost:5173";
const storedImages = new Map<string, Buffer>();
const storage: ImageStorage = {
  async upload({ bytes, extension }) {
    const url = `https://storage.example.com/product-images/${randomUUID()}.${extension}`;
    storedImages.set(url, bytes);
    return url;
  },
  owns: (url) => url.startsWith("https://storage.example.com/product-images/"),
  async remove(url) { storedImages.delete(url); },
};
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=";
let adminCookie: string;
let userCookie: string;
const product = {
  name: "Teclado de prueba",
  description: "Periférico para pruebas de integración",
  brand: "TecnoYa",
  category: "teclados",
  priceCents: 1200000,
  stock: 3,
  imageUrl: "",
};
async function register(email: string) {
  const response = await request(app)
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({ name: "Prueba", email, password: "PruebaSegura123!" });
  expect(response.status, response.text).toBe(200);
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongo.getUri("tecnoya_test");
  await mongoose.connect(uri);
  authBundle = createAuth(
    uri,
    "test-only-secret-with-more-than-32-characters",
    origin,
    { clientId: "test-client.apps.googleusercontent.com", clientSecret: "test-only" },
  );
  await authBundle.client.connect();
  app = createApp(authBundle.auth, origin, storage);
  adminCookie = await register("admin@example.com");
  await authBundle.client
    .db()
    .collection("user")
    .updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } });
  userCookie = await register("user@example.com");
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await authBundle?.client.close();
  await mongo?.stop();
});
describe("Permisos y ciclo completo del catálogo", () => {
  it("usa herramientas de LangChain para comparar únicamente productos activos", async () => {
    const fixtures = await Product.insertMany([
      { ...product, name: "Teclado recomendado" },
      { ...product, name: "Teclado alternativo", priceCents: 1400000 },
      { ...product, name: "Teclado archivado", archivedAt: new Date() },
      { ...product, name: "Teclado sin stock", stock: 0 },
    ]);
    const ids = fixtures.slice(0, 2).map(({ _id }) => _id.toString());
    let calls = 0;
    const compare = buildCatalogAssistant(new ChatGroq({
      apiKey: "test-only",
      model: "openai/gpt-oss-20b",
      maxRetries: 0,
      fetch: async (_url, init) => {
        const call = calls++;
        const input = JSON.parse(init.body);
        expect(input.tools.map(({ function: tool }: { function: { name: string } }) => tool.name))
          .toEqual(["buscar_productos", "consultar_o_comparar_productos"]);
        if (call > 0) {
          const result = JSON.parse(input.messages.at(-1).content);
          expect(result.map(({ id }: { id: string }) => id)).toEqual(ids);
        }
        const selected = call === 0
          ? { name: "buscar_productos", arguments: JSON.stringify({ category: "teclados", inStock: true }) }
          : { name: "consultar_o_comparar_productos", arguments: JSON.stringify({ ids }) };
        return Response.json({
          id: "test-completion",
          model: "openai/gpt-oss-20b",
          choices: [{
            index: 0,
            finish_reason: call < 2 ? "tool_calls" : "stop",
            message: call < 2 ? {
              role: "assistant", content: null,
              tool_calls: [{ id: `call_${call}`, type: "function", function: selected }],
            } : { role: "assistant", content: "El Teclado recomendado cuesta menos." },
          }],
        });
      },
    }));
    try {
      const assistantApp = createApp(authBundle.auth, origin, storage, compare);
      const route = "/api/assistant/chat";
      const input = { message: "Compará los dos teclados más baratos con stock." };
      await request(assistantApp).post(route).send(input).expect(401);
      await request(assistantApp).post(route).set("Cookie", userCookie).send({ message: "" }).expect(400);
      const answer = await request(assistantApp).post(route).set("Cookie", userCookie).send(input).expect(200);
      expect(answer.body.message).toContain("cuesta menos");
      expect(answer.body.products.map(({ id }: { id: string }) => id)).toEqual(ids);
      expect(answer.body.products[0]).not.toHaveProperty("description");
      expect(calls).toBe(3);
    } finally {
      await Product.deleteMany({ _id: { $in: fixtures.map(({ _id }) => _id) } });
    }
  });

  it("sube imágenes, conserva su URL al editar y limpia reemplazos y bajas físicas", async () => {
    const { imageUrl: emptyUrl, ...fields } = product;
    expect(emptyUrl).toBe("");
    const input = { ...fields, imageBase64: pngBase64 };
    await request(app).post("/api/products").set("Cookie", userCookie).send(input).expect(403);
    await request(app).post("/api/products").set("Cookie", adminCookie)
      .send({ ...input, imageBase64: Buffer.from("archivo falso").toString("base64") }).expect(400);
    expect(storedImages.size).toBe(0);

    const created = await request(app).post("/api/products")
      .set("Cookie", adminCookie).send(input).expect(201);
    const route = `/api/products/${created.body._id}`;
    const original = created.body.imageUrl;
    expect(storedImages.get(original)).toEqual(Buffer.from(pngBase64, "base64"));
    expect(await Product.collection.findOne({ _id: new mongoose.Types.ObjectId(created.body._id) }))
      .not.toHaveProperty("imageBase64");
    const edited = await request(app).patch(route)
      .set("Cookie", adminCookie).send({ stock: 5 }).expect(200);
    expect(edited.body.imageUrl).toBe(original);
    const replaced = await request(app).patch(route)
      .set("Cookie", adminCookie).send({ imageBase64: pngBase64 }).expect(200);
    const current = replaced.body.imageUrl;
    expect(current).not.toBe(original);
    expect(storedImages.has(original)).toBe(false);
    await request(app).delete(route).set("Cookie", adminCookie).expect(204);
    expect(storedImages.has(current)).toBe(true);
    await request(app).delete(`${route}/permanent`).set("Cookie", adminCookie).expect(204);
    expect(storedImages.has(current)).toBe(false);
  });

  it("publica una especificación Swagger 2.0 válida con las operaciones de TecnoYa", async () => {
    const response = await request(app).get("/api/docs/swagger.json").expect(200);
    expect(response.body.swagger).toBe("2.0");
    expect(response.body.basePath).toBe("/api");
    expect(response.body.paths["/products/{id}/permanent"].delete).toBeDefined();
    expect(response.body.paths["/admin/users/{id}/sessions/{sessionId}"].delete).toBeDefined();
    expect(response.body.paths["/auth/callback/{id}"].get).toBeDefined();
    expect(response.body.paths["/auth/admin/set-role"]).toBeUndefined();
    await SwaggerParser.validate(response.body);
  });

  it("inicia OAuth de Google con el callback de TecnoYa", async () => {
    const response = await request(app)
      .post("/api/auth/sign-in/social")
      .set("Origin", origin)
      .send({ provider: "google", callbackURL: "/", errorCallbackURL: "/login?google=1" })
      .expect(200);
    const authorization = new URL(response.body.url);
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/auth/callback/google`,
    );
    expect(authorization.searchParams.get("state")).toBeTruthy();
  });

  it("persiste usuarios y sesiones y asigna rol user por defecto", async () => {
    const response = await request(app)
      .get("/api/auth/get-session")
      .set("Cookie", userCookie);
    expect(response.body.user.role).toBe("user");
    expect(
      await authBundle.client.db().collection("session").countDocuments(),
    ).toBe(2);
  });
  it("rechaza escritura anónima y de usuario común", async () => {
    expect(
      (await request(app).post("/api/products").send(product)).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/products")
          .set("Cookie", userCookie)
          .send(product)
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get("/api/admin/products").set("Cookie", userCookie))
        .status,
    ).toBe(403);
  });
  it("rechaza entradas inválidas y campos no permitidos", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send({ ...product, priceCents: -1, role: "admin" });
    expect(response.status).toBe(400);
    expect((await request(app).get("/api/products/invalido")).status).toBe(400);
  });
  it("crea, modifica, archiva, restaura y elimina con impacto público", async () => {
    const created = await request(app)
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send(product);
    expect(created.status, created.text).toBe(201);
    const id = created.body._id as string;
    expect((await request(app).get("/api/products")).body.items).toHaveLength(
      1,
    );
    expect(
      (
        await request(app)
          .patch(`/api/products/${id}`)
          .set("Cookie", adminCookie)
          .send({ stock: 0 })
      ).body.stock,
    ).toBe(0);
    expect(
      (
        await request(app)
          .delete(`/api/products/${id}/permanent`)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`/api/products/${id}`)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(204);
    expect((await request(app).get("/api/products")).body.items).toHaveLength(
      0,
    );
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(404);
    expect(
      (
        await request(app)
          .get("/api/admin/products?status=archived")
          .set("Cookie", adminCookie)
      ).body.items,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .post(`/api/products/${id}/restore`)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(200);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(200);
    await request(app).delete(`/api/products/${id}`).set("Cookie", adminCookie);
    expect(
      (
        await request(app)
          .delete(`/api/products/${id}/permanent`)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get(`/api/admin/products/${id}`)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(404);
  });
  it("rechaza orígenes externos y credenciales incorrectas", async () => {
    expect(
      (
        await request(app)
          .post("/api/products")
          .set("Cookie", adminCookie)
          .set("Origin", "https://otro.example")
          .send(product)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/auth/sign-in/email")
          .set("Origin", origin)
          .send({ email: "user@example.com", password: "incorrecta" })
      ).status,
    ).toBe(401);
  });
  it("pagina sin repetir productos y ajusta la última página tras una baja", async () => {
    const products = await Product.insertMany([
      product,
      { ...product, name: "Otro teclado" },
      { ...product, category: "mouse", archivedAt: new Date() },
    ]);
    try {
      const first = await request(app).get("/api/products?page=1&limit=1");
      const second = await request(app).get("/api/products?page=2&limit=1");
      expect(first.body).toMatchObject({ page: 1, total: 2, totalPages: 2 });
      expect(second.body).toMatchObject({ page: 2, total: 2, totalPages: 2 });
      expect(first.body.items[0]._id).not.toBe(second.body.items[0]._id);
      expect((await request(app).get("/api/products?limit=51")).status).toBe(400);
      expect((await request(app).get("/api/products?page=0")).status).toBe(400);

      await request(app)
        .delete(`/api/products/${second.body.items[0]._id}`)
        .set("Cookie", adminCookie)
        .expect(204);
      const active = await request(app)
        .get("/api/admin/products?status=active&page=2&limit=1")
        .set("Cookie", adminCookie);
      expect(active.body).toMatchObject({ page: 1, total: 1, totalPages: 1 });
      const archived = await request(app)
        .get("/api/admin/products?status=archived&limit=1")
        .set("Cookie", adminCookie);
      expect(archived.body).toMatchObject({ page: 1, total: 2, totalPages: 2 });
      const filtered = await request(app).get("/api/products?category=mouse");
      expect(filtered.body.items).toEqual([]);
    } finally {
      await Product.deleteMany({ _id: { $in: products.map(({ _id }) => _id) } });
    }
  });

  it("administra roles y revoca sesiones sin exponer tokens", async () => {
    const endpoint = "/api/admin/users";
    await request(app).get(endpoint).expect(401);
    await request(app).get(endpoint).set("Cookie", userCookie).expect(403);
    const { body } = await request(app).get(endpoint).set("Cookie", adminCookie).expect(200);
    const adminId = body.items.find(({ role }: { role: string }) => role === "admin").id;
    const userId = body.items.find(({ role }: { role: string }) => role === "user").id;
    await request(app).patch(`${endpoint}/${adminId}/role`)
      .set("Cookie", adminCookie).send({ role: "user" }).expect(400);
    await request(app).post("/api/auth/admin/set-role")
      .set("Cookie", adminCookie).send({ userId: adminId, role: "user" }).expect(404);
    await request(app).patch(`${endpoint}/${userId}/role`)
      .set("Cookie", userCookie).send({ role: "admin" }).expect(403);
    await request(app).patch(`${endpoint}/${userId}/role`)
      .set("Cookie", adminCookie).send({ role: "admin" }).expect(204);
    await request(app).get(endpoint).set("Cookie", userCookie).expect(200);

    const sessions = `${endpoint}/${userId}/sessions`;
    const listed = await request(app).get(sessions).set("Cookie", adminCookie).expect(200);
    expect(listed.body.items).toHaveLength(1);
    const [session] = listed.body.items;
    expect(session).not.toHaveProperty("token");
    await request(app).delete(`${endpoint}/${adminId}/sessions/${session.id}`)
      .set("Cookie", adminCookie).expect(404);
    await request(app).delete(`${sessions}/${session.id}`)
      .set("Cookie", adminCookie).expect(204);
    await request(app).get(endpoint).set("Cookie", userCookie).expect(401);
    await request(app).patch(`${endpoint}/${userId}/role`)
      .set("Cookie", adminCookie).send({ role: "user" }).expect(204);
  });

  it("solo permite una de dos degradaciones simultáneas entre administradores", async () => {
    const endpoint = "/api/admin/users";
    const otherCookie = await register("other-admin@example.com");
    const { body } = await request(app).get(endpoint).set("Cookie", adminCookie).expect(200);
    const adminId = body.items.find(({ email }: { email: string }) => email === "admin@example.com").id;
    const otherId = body.items.find(({ email }: { email: string }) => email === "other-admin@example.com").id;
    await request(app).patch(`${endpoint}/${otherId}/role`)
      .set("Cookie", adminCookie).send({ role: "admin" }).expect(204);
    const results = await Promise.all([
      request(app).patch(`${endpoint}/${otherId}/role`)
        .set("Cookie", adminCookie).send({ role: "user" }),
      request(app).patch(`${endpoint}/${adminId}/role`)
        .set("Cookie", otherCookie).send({ role: "user" }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([204, 403]);
    const admins = authBundle.client.db().collection("user");
    expect(await admins.countDocuments({ role: "admin" })).toBe(1);
    await admins.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } });
  });

  it("cerrar sesión invalida el acceso administrativo", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/sign-out")
          .set("Origin", origin)
          .set("Cookie", adminCookie)
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/admin/products").set("Cookie", adminCookie))
        .status,
    ).toBe(401);
  });
});
