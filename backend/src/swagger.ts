import type { Express } from "express";
import { createRequire } from "node:module";
import { z } from "zod";
import type { Auth } from "./auth.js";
import { categories, productInput } from "./product.js";

type Schema = Record<string, unknown>;
type Parameter = Record<string, unknown>;
type SwaggerResponse = { description: string; schema?: Schema };
type Operation = {
  tags: string[];
  summary: string;
  description?: string;
  produces?: string[];
  parameters?: Parameter[];
  responses: Record<string, SwaggerResponse>;
};
type Paths = Record<string, Record<string, Operation>>;

const ref = (name: string): Schema => ({ $ref: `#/definitions/${name}` });
const text = { type: "string" };
const date = { type: "string", format: "date-time" };
const integer = { type: "integer" };
const role = { ...text, enum: ["user", "admin"] };
const object = (properties: Record<string, Schema>): Schema => ({
  type: "object",
  properties,
});
const list = (name: string): Schema => ({ type: "array", items: ref(name) });
const json = (schema: Schema, description = "Solicitud exitosa"): SwaggerResponse =>
  ({ description, schema });
const error = (description: string) => json(ref("Error"), description);
const invalid = { 400: error("Datos o identificador inválidos") };
const restricted = {
  401: error("Se requiere una sesión"),
  403: error("Se requieren permisos de administrador"),
};
const missing = { 404: error("Recurso inexistente") };
const noContent = { 204: { description: "Operación completada" } };
const uploadErrors = {
  413: error("La solicitud supera el límite de tamaño"),
  502: error("Storage no pudo guardar la imagen"),
  503: error("Storage aún no está configurado"),
};
const id = { name: "id", in: "path", required: true, ...text };
const sessionId = { ...id, name: "sessionId" };
const paging = [
  { name: "page", in: "query", ...integer, default: 1, minimum: 1 },
  { name: "limit", in: "query", ...integer, default: 12, minimum: 1, maximum: 50 },
];
const payload = (name: string) => ({ name: "body", in: "body", required: true, schema: ref(name) });
const adminDescription = "Requiere una sesión de administrador iniciada en TecnoYa.";

function operation(
  tag: string,
  summary: string,
  responses: Operation["responses"],
  parameters: Parameter[] = [],
  admin = false,
): Operation {
  return {
    tags: [tag], summary, parameters,
    ...(admin && { description: adminDescription }),
    responses: admin ? { ...responses, ...restricted } : responses,
  };
}

function productOperation(
  summary: string,
  responses: Operation["responses"],
  parameters?: Parameter[],
  admin?: boolean,
) {
  return operation("Productos", summary, responses, parameters, admin);
}

function adminOperation(summary: string, responses: Operation["responses"], parameters?: Parameter[]) {
  return operation("Usuarios y sesiones", summary, responses, parameters, true);
}

const paths: Paths = {
  "/health": {
    get: operation("Servicio", "Comprobar conexión a MongoDB", {
      200: json(ref("Health")), 503: json(ref("Health"), "MongoDB no disponible"),
    }),
  },
  "/products": {
    get: productOperation("Listar productos activos", { 200: json(ref("ProductPage")), ...invalid }, [
      ...paging, { name: "category", in: "query", ...text, enum: [...categories] },
    ]),
    post: productOperation("Crear un producto", {
      201: json(ref("Product"), "Producto creado"), ...invalid, ...uploadErrors,
    }, [payload("ProductInput")], true),
  },
  "/products/{id}": {
    get: productOperation("Consultar un producto activo", { 200: json(ref("Product")), ...invalid, ...missing }, [id]),
    patch: productOperation("Editar un producto", {
      200: json(ref("Product")), ...invalid, ...missing, ...uploadErrors,
      409: error("La imagen se modificó en otra solicitud"),
    }, [id, payload("ProductPatch")], true),
    delete: productOperation("Archivar un producto", { ...noContent, ...invalid, ...missing }, [id], true),
  },
  "/products/{id}/restore": {
    post: productOperation("Restaurar un producto archivado", { 200: json(ref("Product")), ...invalid, ...missing }, [id], true),
  },
  "/products/{id}/permanent": {
    delete: productOperation("Eliminar definitivamente un producto archivado", {
      ...noContent, 400: error("Identificador inválido o producto sin archivar"), ...missing,
    }, [id], true),
  },
  "/admin/products": {
    get: productOperation("Listar productos por estado para administración", { 200: json(ref("ProductPage")), ...invalid }, [
      ...paging, { name: "status", in: "query", ...text, enum: ["active", "archived"], default: "active" },
    ], true),
  },
  "/admin/products/{id}": {
    get: productOperation("Consultar un producto por su identificador para administración", { 200: json(ref("Product")), ...invalid, ...missing }, [id], true),
  },
  "/admin/users": {
    get: adminOperation("Listar usuarios y roles", { 200: json(ref("UserPage")), ...invalid }, paging),
  },
  "/admin/users/{id}/role": {
    patch: adminOperation("Cambiar el rol de otro usuario", {
      ...noContent, 400: error("Datos inválidos o intento de cambiar el rol propio"), ...missing,
    }, [id, payload("RoleChange")]),
  },
  "/admin/users/{id}/sessions": {
    get: adminOperation("Listar sesiones activas del usuario", { 200: json(ref("ActiveSessions")), ...invalid }, [id]),
  },
  "/admin/users/{id}/sessions/{sessionId}": {
    delete: adminOperation("Revocar una sesión activa del usuario", { ...noContent, ...invalid, ...missing }, [id, sessionId]),
  },
  "/docs": {
    get: { tags: ["Servicio"], summary: "Abrir Swagger UI", produces: ["text/html"], responses: { 200: { description: "Documentación interactiva" } } },
  },
  "/docs/swagger.json": {
    get: operation("Servicio", "Descargar la especificación Swagger 2.0", { 200: { description: "Especificación Swagger 2.0 en JSON" } }),
  },
};

const productSchema = z.toJSONSchema(productInput, { target: "draft-04", io: "input" });
const productProperties = {
  ...productSchema.properties,
  imageUrl: { ...text, description: "URL HTTPS, o cadena vacía" },
};
const productWriteProperties = {
  ...productProperties,
  imageBase64: {
    type: "string",
    format: "byte",
    description: "Archivo JPEG, PNG o WebP de hasta 2 MB sin prefijo de Data URL. Enviá este campo o imageUrl.",
  },
};
const definitions = {
  Error: object({ code: text, message: text, fields: { type: "object" } }),
  Health: object({ status: { ...text, enum: ["ok", "unavailable"] } }),
  ProductInput: { ...object(productWriteProperties), required: productSchema.required },
  ProductPatch: { ...object(productWriteProperties), minProperties: 1 },
  Product: object({ ...productProperties, _id: text, archivedAt: { ...date, "x-nullable": true }, createdAt: date, updatedAt: date }),
  ProductPage: object({ items: list("Product"), page: integer, limit: integer, total: integer, totalPages: integer }),
  User: object({ id: text, name: text, email: { ...text, format: "email" }, role }),
  UserPage: object({ items: list("User"), page: integer, totalPages: integer }),
  RoleChange: { ...object({ role }), required: ["role"] },
  ActiveSession: object({ id: text, createdAt: date, expiresAt: date, userAgent: { ...text, "x-nullable": true } }),
  ActiveSessions: object({ items: list("ActiveSession") }),
};

const authSummaries: Record<string, string> = {
  "/sign-up/email": "Crear una cuenta con correo",
  "/sign-in/email": "Ingresar con correo y contraseña",
  "/sign-in/social": "Iniciar el acceso con Google",
  "/callback/:id": "Recibir el retorno de Google",
  "/get-session": "Consultar la sesión actual",
  "/sign-out": "Cerrar la sesión actual",
};

function authPaths(auth: Auth): Paths {
  const result: Paths = {};
  const disabled = new Set<string>(auth.options.disabledPaths);
  for (const [name, endpoint] of Object.entries(auth.api)) {
    if (!endpoint.path || disabled.has(endpoint.path)) continue;
    const { path, options } = endpoint;
    const authPath = `/auth${path.replace(/:([\w-]+)/g, "{$1}")}`;
    const pathParameters = [...path.matchAll(/:([\w-]+)/g)].map((match) => ({ ...id, name: match[1] }));
    const parameters: Parameter[] = [...pathParameters];
    if ("query" in options && options.query instanceof z.ZodType) {
      const query = z.toJSONSchema(options.query, { target: "draft-04", io: "input", unrepresentable: "any" });
      for (const [key, field] of Object.entries(query.properties ?? {})) {
        const type = typeof field === "object" ? field.type : undefined;
        parameters.push({
          name: key, in: "query", required: query.required?.includes(key) ?? false,
          type: type === "boolean" || type === "integer" || type === "number" ? type : "string",
        });
      }
    }
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    for (const method of methods) {
      if (method !== "GET" && method !== "POST") continue;
      const inputs = [...parameters];
      if (method === "POST" && "body" in options && options.body instanceof z.ZodType) {
        const body = z.toJSONSchema(options.body, {
          target: "draft-04", io: "input", unrepresentable: "any",
        });
        inputs.push({ name: "body", in: "body", schema: swaggerBody(body) });
      }
      const summary = authSummaries[path]
        ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (initial) => initial.toUpperCase());
      const responses = path === "/callback/:id"
        ? { 302: { description: "Redirección a TecnoYa" }, ...invalid }
        : { 200: { description: "Respuesta de Better Auth" }, ...invalid, 401: error("Sesión o credenciales inválidas") };
      const entry = result[authPath] ??= {};
      entry[method.toLowerCase()] = operation("Autenticación", summary, responses, inputs);
    }
  }
  return result;
}

function swaggerBody(value: unknown): Schema {
  if (typeof value !== "object" || value === null) return {};
  const schema = value as Schema;
  const {
    type, format, description, required, minimum, maximum, minLength, maxLength,
    pattern, enum: values, default: defaultValue, properties, items,
  } = schema;
  const keywords = {
    type, format, description, required, minimum, maximum, minLength, maxLength,
    pattern, enum: values, default: defaultValue,
  };
  return {
    ...Object.fromEntries(Object.entries(keywords).filter(([, value]) => value !== undefined)),
    ...(typeof properties === "object" && properties !== null && {
      properties: Object.fromEntries(
        Object.entries(properties).map(([key, field]) => [key, swaggerBody(field)]),
      ),
    }),
    ...(typeof items === "object" && items !== null && { items: swaggerBody(items) }),
  };
}

export function swaggerSpec(auth: Auth) {
  return {
    swagger: "2.0",
    info: {
      title: "API de TecnoYa",
      version: "1.0.0",
      description: "Iniciá sesión en TecnoYa en el mismo navegador para probar las rutas privadas. Swagger UI usa la cookie de sesión del sitio.",
    },
    basePath: "/api",
    consumes: ["application/json"],
    produces: ["application/json"],
    paths: { ...paths, ...authPaths(auth) },
    definitions,
  };
}

const require = createRequire(import.meta.url);
const docsPath = "/api/docs";
const assetFiles = ["swagger-ui.css", "swagger-ui-bundle.js"];

export function mountSwagger(app: Express, auth: Auth) {
  const spec = swaggerSpec(auth);
  app.get(docsPath, (_req, res) => res.type("html").send(`<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API de TecnoYa</title>
<link rel="stylesheet" href="${docsPath}/swagger-ui.css">
<div id="swagger-ui"></div>
<script src="${docsPath}/swagger-ui-bundle.js" defer></script>
<script src="${docsPath}/init.js" defer></script>
</html>`));
  app.get(`${docsPath}/swagger.json`, (_req, res) => res.json(spec));
  app.get(`${docsPath}/init.js`, (_req, res) => res.type("js").send(
    'SwaggerUIBundle({url:"/api/docs/swagger.json",dom_id:"#swagger-ui",validatorUrl:null,docExpansion:"none"});',
  ));
  for (const asset of assetFiles) {
    const filename = require.resolve(`swagger-ui-dist/${asset}`);
    app.get(`${docsPath}/${asset}`, (_req, res) => res.sendFile(filename));
  }
}
