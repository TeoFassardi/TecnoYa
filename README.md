# TecnoYa

Catálogo de periféricos con vista pública, autenticación persistente y administración de productos. Precios en pesos argentinos; no procesa compras ni pagos.

Trabajo final de Metodologías y Desarrollos Web, UAI. Integrante: Teo Fassardi. Modelo a cargo: **Product**. Modalidad individual con un modelo, según autorización indicada por el integrante.

## Arquitectura

Monorepo TypeScript estricto. React + Vite, React Router, React Hook Form y Zod en el frontend; Redux Toolkit y RTK Query para estado global y consultas. Express, Mongoose y MongoDB Atlas para productos. Better Auth usa MongoDB para usuarios, cuentas y sesiones. En producción Express sirve también el frontend bajo el mismo origen.

## Requisitos e instalación

- Node.js 22.19 o superior, npm y una base MongoDB (Atlas o un replica set local; la autenticación utiliza transacciones).
- Desde la raíz: `npm ci`.
- Copiar `backend/.env.example` a `backend/.env` y completar sus valores.
- Generar un secreto con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y copiarlo únicamente al archivo de entorno.
- Ejecutar `npm run dev`. Abrir **http://localhost:5173**; el backend escucha en el puerto 3000.

Usar localhost de forma consistente con `BETTER_AUTH_URL` para las cookies y la comprobación de origen.

## Variables del backend

| Variable | Descripción |
| --- | --- |
| `MONGODB_URI` | Cadena de conexión MongoDB, con nombre de base. Nunca versionar credenciales. |
| `BETTER_AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `BETTER_AUTH_URL` | Origen público completo: `http://localhost:5173` en desarrollo; URL HTTPS real en producción. |
| `PORT` | Puerto del backend, 3000 por defecto; Render lo asigna. |
| `NODE_ENV` | `development`, `test` o `production`. |

El frontend utiliza rutas relativas `/api`, sin secretos ni variables obligatorias. Las variables de Google, almacenamiento e IA se agregarán al implementar los opcionales.

## Datos y administrador

1. Ejecutar `npm run seed`: agrega 16 productos de demostración sin sobrescribir los existentes. Los precios son ilustrativos.
2. Registrarse desde la interfaz. Toda cuenta nueva recibe el rol `user`.
3. En una terminal con acceso al entorno del backend: `npm run admin -- correo@ejemplo.com` para promover esa cuenta existente.
4. Acceder a `/admin/products`. La autorización se comprueba en el servidor, no solo en la interfaz.

No existe una contraseña administrativa predeterminada. Las credenciales de entrega se comparten por separado.

## API obligatoria

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/health` | Público; 503 si MongoDB no está conectado |
| GET | `/api/products` y `/api/products/:id` | Público, solo productos activos |
| GET | `/api/admin/products?status=active` o `archived` | Admin |
| GET | `/api/admin/products/:id` | Admin |
| POST | `/api/products` | Admin; crear |
| PATCH | `/api/products/:id` | Admin; modificar |
| DELETE | `/api/products/:id` | Admin; archivar |
| POST | `/api/products/:id/restore` | Admin; restaurar |
| DELETE | `/api/products/:id/permanent` | Admin; eliminar solo archivados |

Autenticación Better Auth bajo `/api/auth`: registro `/sign-up/email`, login `/sign-in/email`, logout `/sign-out` y consulta `/get-session`. Contraseña mínima de 8 caracteres.

Los listados público y administrativo aceptan `?page=2&limit=12`. La página inicial es 1 y el límite predeterminado es 12, con un máximo de 50. La respuesta incluye `items`, `page`, `limit`, `total` y `totalPages`. Si la página solicitada supera la última disponible, se devuelve la última. El catálogo público admite `category` para paginar dentro de una categoría.

Producto: `name`, `description`, `brand`, `category`, `priceCents`, `stock`, `imageUrl`, `archivedAt`, `createdAt`, `updatedAt`. Categorías: `teclados`, `mouse`, `auriculares`, `monitores`. `priceCents` es un entero positivo en centavos ARS; stock es entero no negativo. La URL HTTPS de imagen es opcional en esta etapa.

Los errores de la API de productos contienen `code`, `message` y opcionalmente `fields`. Better Auth conserva su propio formato de errores. Archivar oculta públicamente; restaurar vuelve a publicar; eliminar definitivamente borra de MongoDB. Las dos bajas requieren confirmación en la interfaz.

## Verificación

- `npm run typecheck`
- `npm run lint`
- `npm test`: integración con un MongoDB temporal aislado, incluyendo autenticación real, roles, validaciones y ciclo CRUD completo. La primera ejecución descarga el binario MongoDB.
- `npm run build`
- `npx playwright install chromium` y `npx playwright test`: recorridos de navegador contra una base temporal y la compilación del frontend; ejecutar después de compilar.
- `npm start`: ejecutar después de compilar, con las variables del backend configuradas.

Verificar también en Chrome: registro, errores de login, acceso denegado al usuario común, CRUD admin, cancelar y confirmar modales, efecto público de archivo/restauración/borrado y logout con redirección. Esta comprobación en producción sigue pendiente hasta configurar los servicios.

## Despliegue gratuito en Render

Usar `render.yaml` para crear un Web Service gratuito conectado al repositorio. Completar `MONGODB_URI` con una base Atlas gratuita y `BETTER_AUTH_URL` con la URL HTTPS asignada por Render. El secreto se genera en Render. Configurar acceso de red a Atlas para el entorno de despliegue. Build: `npm ci && npm run build`; inicio: `npm start`; salud: `/api/health`.

La app puede tardar en iniciar después de inactividad en el plan gratuito. No guarda archivos en el disco efímero de Render. Configurar los despliegues manualmente después de integrar PR a main. La creación del servicio, las credenciales, el seed productivo y la promoción de la cuenta admin requieren acceso a los servicios del titular y están pendientes.

## Etapas pendientes

Quedan pendientes Google OAuth, administración de usuarios y sesiones, Swagger **2.0**, carga de imágenes en Supabase Storage (MongoDB guarda solo URL) y el agente LangChain/Groq con herramientas de consulta y comparación.

Todo cambio se trabaja en una rama y se incorpora mediante PR con descripción y pasos de verificación. No subir `.env`, credenciales ni archivos locales de Engram.
