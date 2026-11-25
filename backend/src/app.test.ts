import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
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
