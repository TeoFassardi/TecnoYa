# TecnoYa

## Plataforma
Web responsive, español de Argentina.

## Propósito
Catálogo informativo de periféricos para personas que trabajan, juegan o crean. El visitante consulta productos; el administrador gestiona el catálogo. No hay compras ni pagos.

## Alcance acordado
Un modelo `Product` para teclados, mouse, auriculares y monitores, con precios en ARS y stock. Registro, inicio y cierre de sesión, roles `user` y `admin`, archivo restaurable y borrado definitivo de productos archivados. Los opcionales incluyen paginación, Google, administración de usuarios y sesiones, Swagger 2.0, carga de imágenes y asistente de catálogo.

## Restricciones
MongoDB para los productos y la autenticación, TypeScript estricto en frontend y backend y servicios gratuitos. Supabase Storage aloja las imágenes y MongoDB conserva su URL. Diseño claro con acentos azules.

## Éxito
El recorrido de evaluación de la consigna funciona en producción; cada acción administrativa tiene efecto en los datos públicos; los permisos se aplican en el backend. El integrante puede explicar el flujo completo y presentar PR propios.
