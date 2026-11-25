# Seguir desde acá — TecnoYa

Actualizado: 25 de noviembre de 2026. Documento de continuidad para la próxima sesión del agente y del integrante.

## Por qué existe este archivo

**Tomar este documento como un resumen de sesión y leerlo antes de continuar.** Engram pudo guardar al comienzo, pero luego rechazó nuevas escrituras con `Codex host session resolution could not be confirmed`. El avance posterior no quedó persistido allí. Este archivo conserva decisiones, resultados y contexto relevante de la conversación; no es una transcripción literal.

No afirmar que se guardó en Engram lo que solo figura en este documento. Si se recupera el servicio, reconciliar el contenido con las memorias existentes sin duplicarlas ni borrar hechos vigentes. No inventar identificadores de sesión ni eludir los hooks mediante guardados manuales.

## Objetivo y acuerdos

- TP final de Metodologías y Desarrollos Web, UAI 2026. Fuente de requisitos: `Consigna.md`.
- El usuario desarrolla solo y declaró autorización para presentar un único modelo propio: Product. La consigna general exige dos o tres integrantes; esa excepción fue informada por el usuario, no comprobada con el docente.
- Nombre elegido: **TecnoYa**, inspirado en nombres directos como PelículasYa.
- Catálogo informativo de periféricos: teclados, mouse, auriculares y monitores; precios ARS, diseño claro con detalles azules y adaptable a móvil.
- Sin ventas, pagos, carrito, favoritos, variantes ni conversión de moneda.
- MongoDB obligatorio para productos y autenticación. TypeScript estricto tanto en frontend como en backend.
- **Todos los servicios gratuitos.** No activar planes pagos.
- Primero completar y verificar obligatorios en producción; después implementar **los seis opcionales**, en otra jornada.
- Petición posterior del usuario: **ramas y commits en español, con prefijos en minúsculas `feat`, `fix` o `doc`**. Ejemplo: `feat/administracion-productos`, `fix: corregir validación del precio`. No se reescribieron los nombres en inglés ya publicados.

## Repositorio e implementación

- GitHub: https://github.com/TeoFassardi/TecnoYa
- Al comenzar, la carpeta solo contenía consigna, configuración de Engram y skills. Git detectaba un repositorio en la carpeta de usuario; se creó uno propio dentro del proyecto para aislarlo.
- `main` se inicializó con un commit vacío. El código se incorporó en commits granulares mediante `feat/mandatory-foundation` y fue integrado por el **PR #1**: https://github.com/TeoFassardi/TecnoYa/pull/1
- La integración de PR #1 fue comprobada contra GitHub. No sigue pendiente.
- La creación automática del PR inicialmente falló por autenticación; posteriormente se verificó su existencia e integración. Git Credential Manager permitió los pushes. `gh` no estaba instalado.
- Monorepo npm con `backend/` y `frontend/`.
- Frontend: React, Vite, TypeScript, React Router, React Hook Form, Zod, Redux Toolkit y RTK Query. Iconos Lucide.
- Backend: Express, Mongoose, Zod, Better Auth y su adaptador MongoDB. Usuarios, cuentas y sesiones persistidos en Atlas.
- Cada registro recibe `user`; administrador inicial por comando que promueve una cuenta existente. Comprobación de permisos en backend y protección de pantallas en frontend.
- Producción usa una sola dirección: Express sirve React compilado y las rutas `/api`. Vite hace proxy al backend durante desarrollo.
- Se evaluó Vercel: también puede unificar frontend y backend, pero requiere adaptación de arranque/despliegue. El usuario finalmente eligió **Render** por estar ya preparado.

## Funciones obligatorias implementadas

- Catálogo público, detalle y datos reales desde MongoDB.
- Registro, inicio y cierre de sesión, validaciones y mensajes de error.
- Roles user/admin y administración privada.
- Crear, listar, editar y dar de baja productos; validación de cliente y servidor.
- Confirmación de bajas con cancelar y confirmar.
- Baja lógica: archivar oculta del catálogo, conserva en MongoDB y permite restaurar.
- Baja física: eliminar definitivamente, únicamente desde archivados.
- Stock cero mantiene el producto visible como sin stock.
- Actualización de las consultas después de mutaciones.
- Estados de carga/error/vacío y diseño responsive.

Product incluye nombre, descripción, marca, categoría, precio positivo en centavos enteros ARS, stock entero no negativo, URL opcional de imagen, fecha de archivo y timestamps. Cumple atributos y tipos sin contar autenticación. Consultar código y README para límites exactos.

API pública: `GET /api/products` y `GET /api/products/:id`, solo activos. Administración: `GET /api/admin/products?status=active|archived` y detalle por ID. Escrituras admin: `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id` (archivo), `POST /api/products/:id/restore`, `DELETE /api/products/:id/permanent`. Auth bajo `/api/auth`; salud `/api/health`.

## MongoDB Atlas y configuración local

- Usuario guiado para crear clúster gratuito, usuario de base y autorizar IP local.
- Se creó `backend/.env` con secreto generado, sin mostrarlo; Git lo ignora. **Nunca imprimir ni versionar ese archivo.**
- Primer intento falló por `MONGODB_URI=` repetido en la misma línea: se corrigió sin mostrar credenciales.
- Segundo intento falló con DNS ENOTFOUND por hostname incorrecto: el usuario recopiando la cadena de Atlas lo corrigió.
- `npm run seed` se ejecutó correctamente y confirmó 16 productos de demostración. Es idempotente y no sobrescribe existentes.
- Backend local y proxy respondieron: salud ok, 16 productos, cuatro categorías.
- `npm run dev` arranca frontend/backend; abrir **http://localhost:5173**, consistente con BETTER_AUTH_URL local. No asumir que el proceso siga activo al retomar.
- `npm run admin -- correo` promueve una cuenta ya registrada; cerrar e iniciar sesión después.

## Despliegue en Render

**URL pública: https://tecnoya.onrender.com**

Configurado por el usuario desde el panel: Web Service, Node, rama main, raíz del monorepo vacía, plan Free, build `npm ci --include=dev && npm run build`, inicio `npm start`.

Variables indicadas: MONGODB_URI, BETTER_AUTH_SECRET nuevo para producción, BETTER_AUTH_URL con la URL pública exacta, NODE_ENV=production y NODE_VERSION=22.19.0. Render asigna PORT. Confirmar en el panel que BETTER_AUTH_URL no conserva el valor provisional example.com antes de investigar errores de login.

El arranque inicialmente falló con `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR` al conectar con Atlas. Se indicó agregar **todos los rangos de Render → Connect → Outbound** en Atlas → Network Access y redeployar. El posterior chequeo público confirmó conexión, aunque no se inspeccionaron directamente las entradas del panel de Atlas.

El mensaje `.env not found. Continuing without it.` es normal en Render: las variables llegan desde el panel.

Comprobaciones reales realizadas desde la URL pública:

- `/`: HTTP 200.
- `/api/health`: HTTP 200, status ok.
- `/api/products`: HTTP 200, **15 productos activos** en ese momento; no confundir con los 16 del seed inicial, porque las pruebas de bajas pueden cambiar el total.
- `/api/auth/ok`: HTTP 200.
- `/api/admin/products` sin sesión: HTTP 401.
- `/admin/products`: entrega HTML React; la protección de navegación se evalúa desde la interfaz.

Render gratuito suspende tras inactividad y puede tardar en arrancar; no implica pérdida de MongoDB. No almacenar imágenes en su disco efímero.

**Atención:** `render.yaml` y README todavía muestran el build original `npm ci && npm run build`; el comando indicado al usuario en el panel incluye `--include=dev` para disponer de las herramientas de compilación en producción. Reconciliar configuración y documentación mediante un PR `fix`/`doc`, sin cambiar innecesariamente la app.

## Pruebas y cuentas de entrega

- Tipos, lint y compilación pasaron.
- Seis pruebas de integración con MongoDB temporal: sesiones y rol predeterminado, 401/403, validaciones, ciclo CRUD con archivo/restauración/borrado, rechazo de origen externo y credenciales erróneas, logout que invalida sesión.
- Tres pruebas Playwright pasaron: registro y acceso por URL, administración con modales y efecto público, catálogo responsive. Se generaron capturas en test-results; escritorio inspeccionado visualmente.
- Vitest se actualizó a 5.1.2 para corregir alertas; npm audit quedó en cero vulnerabilidades.
- Better Auth resuelto a 1.7.28 utiliza transacciones con el adaptador configurado: tests deben usar MongoMemoryReplSet, no una instancia standalone. Atlas funcionó.
- El usuario dijo explícitamente que probó todo localmente y funciona. Se entregó también un recorrido completo para producción; el alcance exacto ejecutado allí no fue observado por el agente. No afirmar una prueba automatizada pública de login/CRUD si no se hizo.
- Se propusieron las cuentas `usuario@tecnoya.example` y `admin@tecnoya.example`; el usuario informó asignar contraseñas a usuario y admin de prueba. **Los correos exactos y los roles no se consultaron directamente en la base.**
- A pedido del usuario, las contraseñas comunicadas se conservan solo en `Pruebas.local.md`, ignorado por Git; **no publicarlas ni copiarlas a Engram**. Entregarlas al docente por el canal de entrega. Ese archivo no se recupera clonando GitHub.
- `.example` no recibe correo. Es válido para el registro actual sin verificación; Google requerirá una cuenta real.

## Skills instaladas

Instaladas y verificadas con SKILL.md en `.agents/skills`, disponibles en esta sesión: frontend-design, vercel-react-best-practices, web-design-guidelines, nodejs-backend-patterns, better-auth-best-practices, impeccable y ui-ux-pro-max. Orígenes en skills-lock.json. La carpeta local de skills se ignora en Git. Para documentación actual usar ctx7 CLI según instrucciones del usuario.

## Engram: hechos y fallos

- Al inicio se creó memoria **#1**, marcador `ENGRAMTEST20261125K7Q9M4`, y se comprobó búsqueda y lectura completa.
- Quedaron guardadas memoria **#2**, plan/arquitectura, y **#3**, resumen inicial previo a implementación.
- Después fallaron escrituras por resolución de sesión del host; las búsquedas/lecturas siguieron funcionando. No se confirmó persistencia del avance de implementación, Atlas ni despliegue.
- Antecedente inicial: jq faltaba en PATH heredado por Codex/Git Bash. En el fallo posterior **sí se comprobó jq 1.8.2 disponible en Git Bash**; por tanto no atribuir automáticamente el nuevo fallo al mismo motivo.
- No inventar sesiones, registrar manualmente una para sortear el bloqueo ni tratar un archivo local como prueba de guardado en Engram. Una sesión futura debe usar su identidad confirmada por el runtime.

## Qué queda para la próxima jornada

1. Leer este archivo, README y Consigna; inspeccionar Git y estado del despliegue antes de modificar.
2. Terminar la revisión de obligatorios: verificar el recorrido completo en Chrome **producción**, revisar README y `.env.example`, ausencia de secretos e historial/PR. La funcionalidad y el despliegue están implementados, pero no confundirlo con entrega y coloquio completos.
3. Reconciliar comando de build Render y documentación por PR. Verificar CI remoto, no asumir que el éxito local garantiza su estado remoto.
4. Implementar los seis opcionales en ramas/PR propios en español: paginación backend/frontend; Google operativo en producción; administración de usuarios, roles y sesiones/revocación; documentación **Swagger 2.0** de todos los endpoints; carga externa de imágenes; agente LLM con herramientas reales.
5. Imágenes: Supabase SOLO Storage gratuito; MongoDB conserva URL, no binarios. El usuario preguntó por guardar imágenes en MongoDB y aceptó almacenamiento externo para cumplir el opcional.
6. Agente: LangChain/Groq dentro de cuota gratuita, usuarios autenticados, herramientas de consulta y comparación de productos activos; sin escritura ni compras, con enlaces y errores de cuota claros.
7. Preparar documentación final, cuentas y URLs para entregar; preparar explicación de extremo a extremo y coloquio. Correo de entrega al menos una semana antes de mesa según Consigna; no enviar correo sin autorización explícita.

Este archivo no acredita como implementados los opcionales, que siguen pendientes.
