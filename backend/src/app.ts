import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { Auth } from "./auth.js";
import type { Request } from "express";
import { categories, Product, productInput } from "./product.js";

const pagination = z.object({
  page: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().positive()).default(1),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1).max(50)).default(12),
});

async function listProducts(
  filter: { archivedAt: null | { $ne: null }; category?: string },
  query: unknown,
) {
  const { page, limit } = pagination.parse(query);
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const items = await Product.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((currentPage - 1) * limit)
    .limit(limit)
    .lean();
  return { items, page: currentPage, limit, total, totalPages };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApp(auth: Auth, origin: string) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { imgSrc: ["'self'", "https:", "data:"] },
      },
    }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 60000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.all("/api/auth/{*rest}", toNodeHandler(auth));
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== origin
    )
      throw new HttpError(403, "Origen no permitido");
    next();
  });
  async function adminSession(req: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new HttpError(401, "Iniciá sesión para continuar");
    if (session.user.role !== "admin")
      throw new HttpError(403, "Necesitás permisos de administrador");
    return session;
  }
  const requireAdmin: RequestHandler = async (req, _res, next) => {
    await adminSession(req);
    next();
  };
  const validId: RequestHandler = (req, _res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id))
      throw new HttpError(400, "Identificador inválido");
    next();
  };
  app.get("/api/health", (_req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({
        status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
      }),
  );
  app.get("/api/products", async (req, res) => {
    const category = z.enum(categories).optional().parse(req.query.category);
    res.json(await listProducts({
      archivedAt: null,
      ...(category && { category }),
    }, req.query));
  });
  app.get("/api/products/:id", validId, async (req, res) => {
    const product = await Product.findOne({
      _id: req.params.id,
      archivedAt: null,
    }).lean();
    if (!product) throw new HttpError(404, "Producto no encontrado");
    res.json(product);
  });
  app.use("/api/admin", requireAdmin);
  app.get("/api/admin/users", async (req, res) => {
    const { page, limit } = pagination.parse(req.query);
    const offset = z.number().int().parse((page - 1) * limit);
    const { users, total } = await auth.api.listUsers({
      headers: fromNodeHeaders(req.headers),
      query: { limit, offset, sortBy: "email", sortDirection: "asc" },
    });
    res.json({
      items: users.map(({ id, name, email, role }) => ({ id, name, email, role })),
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
  app.patch("/api/admin/users/:id/role", validId, async (req, res) => {
    const { user } = await adminSession(req);
    const { role } = z.strictObject({ role: z.enum(["user", "admin"]) }).parse(req.body);
    const targetId = new ObjectId(z.string().parse(req.params.id));
    const actorId = new ObjectId(user.id);
    if (targetId.equals(actorId))
      throw new HttpError(400, "Otro administrador debe cambiar tu rol");

    const client = mongoose.connection.getClient();
    const users = client.db(mongoose.connection.name).collection("user");
    await client.withSession((session) => session.withTransaction(async () => {
      // Writing the actor and target in one transaction prevents simultaneous
      // demotions from removing the administrators authorizing each other.
      const actor = await users.updateOne(
        { _id: actorId, role: "admin" },
        { $inc: { roleChangeVersion: 1 } },
        { session },
      );
      if (!actor.matchedCount)
        throw new HttpError(403, "Necesitás permisos de administrador");
      const target = await users.updateOne(
        { _id: targetId },
        { $set: { role, updatedAt: new Date() } },
        { session },
      );
      if (!target.matchedCount) throw new HttpError(404, "Usuario no encontrado");
    }));
    res.status(204).end();
  });
  async function activeSessions(req: Request, userId: string) {
    const headers = fromNodeHeaders(req.headers);
    const { sessions } = await auth.api.listUserSessions({ headers, body: { userId } });
    return sessions.filter(({ expiresAt }) => expiresAt.getTime() > Date.now());
  }
  app.get("/api/admin/users/:id/sessions", validId, async (req, res) => {
    const sessions = await activeSessions(req, z.string().parse(req.params.id));
    res.json({
      items: sessions.map(({ id, createdAt, expiresAt, userAgent }) => ({
        id, createdAt, expiresAt, userAgent,
      })),
    });
  });
  app.delete("/api/admin/users/:id/sessions/:sessionId", validId, async (req, res) => {
    const sessions = await activeSessions(req, z.string().parse(req.params.id));
    const session = sessions.find(({ id }) => id === req.params.sessionId);
    if (!session) throw new HttpError(404, "Sesión activa no encontrada");
    await auth.api.revokeUserSession({
      headers: fromNodeHeaders(req.headers),
      body: { sessionToken: session.token },
    });
    res.status(204).end();
  });
  app.get("/api/admin/products", async (req, res) => {
    const status = z
      .enum(["active", "archived"])
      .default("active")
      .parse(req.query.status);
    res.json(await listProducts({
      archivedAt: status === "archived" ? { $ne: null } : null,
    }, req.query));
  });
  app.get("/api/admin/products/:id", validId, async (req, res) => {
    const product = await Product.findById(req.params.id).lean();
    if (!product) throw new HttpError(404, "Producto no encontrado");
    res.json(product);
  });
  app.post("/api/products", requireAdmin, async (req, res) =>
    res.status(201).json(await Product.create(productInput.parse(req.body))),
  );
  app.patch("/api/products/:id", requireAdmin, validId, async (req, res) => {
    const input = productInput
      .partial()
      .refine((v) => Object.keys(v).length > 0, "No hay cambios")
      .parse(req.body);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!product) throw new HttpError(404, "Producto no encontrado");
    res.json(product);
  });
  app.delete("/api/products/:id", requireAdmin, validId, async (req, res) => {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { archivedAt: new Date() } },
      { new: true },
    );
    if (!product) throw new HttpError(404, "Producto no encontrado");
    res.status(204).end();
  });
  app.post(
    "/api/products/:id/restore",
    requireAdmin,
    validId,
    async (req, res) => {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { archivedAt: null } },
        { new: true },
      );
      if (!product) throw new HttpError(404, "Producto no encontrado");
      res.json(product);
    },
  );
  app.delete(
    "/api/products/:id/permanent",
    requireAdmin,
    validId,
    async (req, res) => {
      const product = await Product.findById(req.params.id);
      if (!product) throw new HttpError(404, "Producto no encontrado");
      if (!product.archivedAt)
        throw new HttpError(
          400,
          "Archivá el producto antes de eliminarlo definitivamente",
        );
      await Product.deleteOne({ _id: product._id, archivedAt: { $ne: null } });
      res.status(204).end();
    },
  );
  app.use("/api", () => {
    throw new HttpError(404, "Ruta no encontrada");
  });
  const staticPath = fileURLToPath(
    new URL("../../frontend/dist", import.meta.url),
  );
  if (existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get("/{*rest}", (_req, res) =>
      res.sendFile(path.join(staticPath, "index.html")),
    );
  }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({
          code: "VALIDATION_ERROR",
          message: "Revisá los datos ingresados",
          fields: z.flattenError(error).fieldErrors,
        });
      return;
    }
    if (error instanceof HttpError) {
      res
        .status(error.status)
        .json({ code: `HTTP_${error.status}`, message: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      res
        .status(400)
        .json({ code: "INVALID_JSON", message: "El cuerpo JSON no es válido" });
      return;
    }
    console.error(
      "Error de solicitud",
      error instanceof Error ? error.name : "UnknownError",
    );
    res
      .status(500)
      .json({
        code: "INTERNAL_ERROR",
        message: "No pudimos completar la operación",
      });
  };
  app.use(errors);
  return app;
}
