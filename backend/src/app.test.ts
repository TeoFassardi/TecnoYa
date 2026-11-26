import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
import { Product } from "./product.js";
import SwaggerParser from "@apidevtools/swagger-parser";
let mongo: MongoMemoryReplSet;
let authBundle: ReturnType<typeof createAuth>;
let app: ReturnType<typeof createApp>;
const origin = "http://localhost:5173";
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
  app = createApp(authBundle.auth, origin);
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
