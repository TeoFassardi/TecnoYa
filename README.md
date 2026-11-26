# TecnoYa

Catálogo público de teclados, mouse, auriculares y monitores con precios en pesos argentinos. Los visitantes pueden consultar productos y su disponibilidad. Los administradores pueden gestionar el catálogo y los usuarios. El catálogo es informativo.

Trabajo final de Metodologías y Desarrollos Web, UAI, en modalidad individual.

| Integrante | Modelo a cargo |
| --- | --- |
| Teo Fassardi | `Product` |

**Producción:** [TecnoYa](https://tecnoya.onrender.com) · [Swagger 2.0](https://tecnoya.onrender.com/api/docs)

## Funcionalidades

- **Catálogo y CRUD de productos.** El público ve los productos activos. Un administrador puede crear, editar, archivar, restaurar y eliminar definitivamente productos archivados.
- **Registro y sesiones.** El acceso con correo y contraseña persiste usuarios y sesiones en MongoDB. Las cuentas nuevas reciben el rol `user`.
- **Paginación.** El catálogo público y el listado de administración consultan páginas a la API.
- **Google OAuth.** El ingreso con Google está integrado en la pantalla de inicio de sesión.
- **Usuarios y sesiones.** En `/admin/users`, un administrador puede cambiar roles de otras cuentas y consultar o revocar sus sesiones activas.
- **Swagger 2.0.** La API se puede explorar y probar desde `/api/docs`.
- **Imágenes externas.** Supabase Storage guarda los archivos y MongoDB guarda sus URL.
- **Asistente de catálogo.** En `/assistant`, LangChain y Groq consultan los productos activos mediante herramientas de búsqueda y comparación.

## Arquitectura

Monorepo npm con TypeScript estricto. El frontend usa React, Vite, React Router, React Hook Form, Zod y Redux Toolkit con RTK Query. El backend expone una API REST con Express y Mongoose. MongoDB Atlas persiste los productos y los datos de Better Auth. Render sirve el frontend compilado y la API bajo el mismo origen. Supabase Storage aloja las imágenes y LangChain integra Groq para el asistente.

## Requisitos e instalación

Se requiere Node.js 22.19 o superior, npm y MongoDB Atlas o un conjunto de réplicas local que admita transacciones.

1. Ejecutar `npm ci` desde la raíz del repositorio.
2. Copiar `backend/.env.example` a `backend/.env`. Completar `MONGODB_URI` y generar `BETTER_AUTH_SECRET` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Ejecutar `npm run seed` para cargar los productos de demostración.
4. Ejecutar `npm run dev` y abrir **http://localhost:5173**. En desarrollo, Vite reenvía las solicitudes de la API al backend, que escucha en el puerto 3000.

Usar `http://localhost:5173` también en `BETTER_AUTH_URL`. Google, Storage y Groq se habilitan con las variables indicadas a continuación. El catálogo y la autenticación por correo funcionan con la configuración básica.

## Variables del backend

| Variable | Descripción |
| --- | --- |
| `MONGODB_URI` | Cadena de conexión MongoDB, con nombre de base. Nunca versionar credenciales. |
| `BETTER_AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `BETTER_AUTH_URL` | Origen público completo: `http://localhost:5173` en desarrollo; URL HTTPS real en producción. |
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth web de Google. |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth, configurado junto con el ID en el backend. |
| `SUPABASE_URL` | URL HTTPS del proyecto Supabase para Storage. |
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto. Se configura solo en el backend. |
| `SUPABASE_STORAGE_BUCKET` | Nombre del bucket público, `product-images` por defecto. |
| `GROQ_API_KEY` | Clave de Groq para habilitar el asistente, solo en el backend. |
| `GROQ_MODEL` | Modelo con soporte de herramientas. El predeterminado es `openai/gpt-oss-20b`. |
| `PORT` | Puerto del backend, 3000 por defecto; Render lo asigna. |
| `NODE_ENV` | `development`, `test` o `production`. |

El frontend utiliza rutas relativas `/api`, sin secretos ni variables obligatorias.

## Inicio de sesión con Google

1. En [Google Auth Platform](https://console.cloud.google.com/auth/clients), configurá la pantalla de consentimiento y creá un cliente OAuth de tipo **Aplicación web**.
2. Registrá exactamente `https://tecnoya.onrender.com/api/auth/callback/google` como URI de redireccionamiento autorizada. Para desarrollo local, usá un cliente de prueba con `http://localhost:5173/api/auth/callback/google`.
3. Cargá `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Render y desplegá `main`. En desarrollo podés cargarlos en `backend/.env`. Ambos pueden quedar vacíos para usar solo el acceso con contraseña.
4. Desde `/login`, elegí **Continuar con Google**. Probá con una cuenta nueva en TecnoYa y verificá el regreso al catálogo, la sesión activa y el acceso denegado a `/admin/products`.

Las cuentas nuevas reciben el rol `user`. Si el correo ya está registrado con contraseña, usá ese método de ingreso para esa cuenta.

## Imágenes de productos

1. Creá un proyecto gratuito en Supabase. En **Storage**, creá el bucket público `product-images`. Limitá las cargas a 2 MB y a `image/jpeg`, `image/png` y `image/webp`. El backend escribe con la clave secreta, así que el catálogo solo necesita acceso público de lectura.
2. Copiá la URL del proyecto y la clave secreta a `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en Render. Para probar localmente, cargalas en `backend/.env`.
3. Desplegá `main`. Como admin, seleccioná un archivo al crear o editar un producto y comprobá que se vea en el catálogo. MongoDB guarda la URL pública y Supabase Storage guarda el archivo.

El alta y la edición aceptan `imageBase64` para la carga. Omitir el campo conserva la imagen actual al editar, y enviar `imageUrl: ""` la quita. El archivo se conserva al archivar. El reemplazo, la eliminación de la imagen y el borrado definitivo limpian la imagen anterior de Storage cuando deja de estar referenciada.

## Datos y administrador

1. Ejecutar `npm run seed` si todavía no se cargaron los datos. El comando agrega 16 productos de demostración y conserva los existentes.
2. Registrarse desde la interfaz. Toda cuenta nueva recibe el rol `user`.
3. En una terminal con acceso al entorno del backend: `npm run admin -- correo@ejemplo.com` para promover esa cuenta existente.
4. Acceder a `/admin/products`. La autorización se comprueba en el servidor, no solo en la interfaz.

No existe una contraseña administrativa predeterminada. Las credenciales de entrega se comparten por separado.

## API REST

La documentación interactiva está en `/api/docs` y la especificación **Swagger 2.0** en `/api/docs/swagger.json`. Para probar rutas privadas desde Swagger UI, iniciá sesión en TecnoYa en el mismo navegador. Las operaciones de administración requieren el rol `admin`.

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/health` | Público; 503 si MongoDB no está conectado |
| GET | `/api/products` y `/api/products/:id` | Público, solo productos activos |
| GET | `/api/admin/products?status=active` o `archived` | Admin |
| GET | `/api/admin/products/:id` | Admin |
| GET | `/api/admin/users?page=1&limit=12` | Admin; listar usuarios y roles |
| PATCH | `/api/admin/users/:id/role` | Admin; cambiar el rol de otro usuario |
| GET | `/api/admin/users/:id/sessions` | Admin; listar sesiones activas |
| DELETE | `/api/admin/users/:id/sessions/:sessionId` | Admin; revocar una sesión |
| POST | `/api/products` | Admin; crear |
| PATCH | `/api/products/:id` | Admin; modificar |
| DELETE | `/api/products/:id` | Admin; archivar |
| POST | `/api/products/:id/restore` | Admin; restaurar |
| DELETE | `/api/products/:id/permanent` | Admin; eliminar solo archivados |

Autenticación Better Auth bajo `/api/auth`: registro `/sign-up/email`, login `/sign-in/email`, logout `/sign-out` y consulta `/get-session`. Contraseña mínima de 8 caracteres.

Los listados de productos aceptan `page` y `limit`. La API usa la página 1 y un límite de 12 por defecto, con un máximo de 50. El catálogo solicita 8 productos por página y el panel usa 12. La respuesta incluye `items`, `page`, `limit`, `total` y `totalPages`. Si la página solicitada supera la última disponible, se devuelve la última. El listado público admite el filtro `category`.

`Product` incluye `name`, `description`, `brand`, `category`, `priceCents`, `stock`, `imageUrl`, `archivedAt`, `createdAt` y `updatedAt`. Las categorías son `teclados`, `mouse`, `auriculares` y `monitores`. El precio se guarda en centavos de ARS y el stock es un entero no negativo. La imagen es opcional.

Los errores de la API de productos contienen `code`, `message` y opcionalmente `fields`. Better Auth conserva su propio formato de errores. Archivar oculta públicamente; restaurar vuelve a publicar; eliminar definitivamente borra de MongoDB. Las dos bajas requieren confirmación en la interfaz.

## Verificación

- `npm run typecheck`
- `npm run lint`
- `npm test`: integración con un MongoDB temporal aislado, incluyendo autenticación real, roles, validaciones y ciclo CRUD completo. La primera ejecución descarga el binario MongoDB.
- `npm run build`
- `npx playwright install chromium` y `npx playwright test`: recorridos de navegador contra una base temporal y la compilación del frontend; ejecutar después de compilar.
- `npm start`: ejecutar después de compilar, con las variables del backend configuradas.

Para repetir la verificación en producción con Chrome, probá el registro, los errores de inicio de sesión, el acceso denegado al usuario común y el CRUD como administrador. Comprobá que los modales permitan cancelar o confirmar, que el catálogo refleje las bajas y la restauración, y que cerrar sesión redirija al inicio.

## Despliegue gratuito en Render

La aplicación está disponible en [TecnoYa](https://tecnoya.onrender.com). Para reproducir el despliegue, usá `render.yaml` para crear un Web Service gratuito conectado al repositorio. Configurá `MONGODB_URI` con una base Atlas gratuita y `BETTER_AUTH_URL` con la URL HTTPS del servicio. Generá el secreto en Render y habilitá el acceso de red desde Render en Atlas.

El build usa `npm ci --include=dev && npm run build` para instalar las herramientas de compilación. El servicio arranca con `npm start` y comprueba su estado en `/api/health`. Desplegá manualmente después de integrar los PR a `main`. La app puede tardar en arrancar tras un período de inactividad en el plan gratuito.

## Asistente del catálogo

Creá una clave desde [Groq Console](https://console.groq.com/keys) en una cuenta del plan gratuito. Cargá `GROQ_API_KEY` en Render y desplegá `main`. Para probar localmente, cargala en `backend/.env`. Con sesión iniciada, entrá a **Asistente** y preguntá, por ejemplo, «¿Qué teclados tienen stock?».

`POST /api/assistant/chat` requiere sesión. LangChain usa Groq para elegir herramientas que consultan productos activos de MongoDB por nombre, marca, categoría, presupuesto y stock, o comparan productos por ID. Las fichas y enlaces provienen de esas consultas. El historial reciente viaja con cada pregunta y se mantiene en la pantalla mientras el chat está abierto. TecnoYa limita las solicitudes a seis por minuto por cuenta.

Todo cambio se trabaja en una rama y se incorpora mediante PR con descripción y pasos de verificación. No subir `.env`, credenciales ni archivos locales de Engram.
