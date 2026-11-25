# Metodologías y Desarrollos Web — Trabajo Práctico Final

**Facultad de Tecnología Informática · UAI**

Consigna, requisitos y criterios de evaluación.

| Campo | Detalle |
| --- | --- |
| Asignatura | Metodologías y Desarrollos Web |
| Turno | Mañana |
| Docente a cargo | Tomás Arias Karle |
| Ciclo lectivo | 2026 |
| Modalidad | Grupal (2 o 3 integrantes), con calificación individual |
| Entrega | Por correo electrónico, hasta una semana antes de la mesa de examen |

## Índice

- [1. Objetivo](#1-objetivo)
- [2. Modalidad y conformación de los grupos](#2-modalidad-y-conformación-de-los-grupos)
- [3. Stack tecnológico](#3-stack-tecnológico)
- [4. Requisitos obligatorios](#4-requisitos-obligatorios)
  - [4.1. Repositorio y metodología de trabajo](#41-repositorio-y-metodología-de-trabajo)
  - [4.2. README profesional](#42-readme-profesional)
  - [4.3. Backend](#43-backend)
  - [4.4. Frontend](#44-frontend)
  - [4.5. Despliegue](#45-despliegue)
  - [4.6. Coloquio](#46-coloquio)
- [5. Requisitos opcionales](#5-requisitos-opcionales)
- [6. Evaluación](#6-evaluación)
  - [Causales de desaprobación](#causales-de-desaprobación)
- [7. Entrega](#7-entrega)
  - [Lista de verificación previa a la entrega](#lista-de-verificación-previa-a-la-entrega)

## 1. Objetivo

El presente trabajo práctico tiene por objetivo que el alumno integre los contenidos desarrollados durante la cursada mediante la construcción de una aplicación web full stack de temática libre, desplegada en la nube y desarrollada en equipo, aplicando prácticas profesionales de control de versiones, documentación y despliegue.

Se espera que cada integrante sea capaz de diseñar, implementar, desplegar y defender oralmente la porción del sistema bajo su responsabilidad, comprendiendo además el funcionamiento integral de la aplicación.

## 2. Modalidad y conformación de los grupos

El trabajo se realiza en grupos de dos (2) o tres (3) integrantes. La cantidad de entidades o modelos a desarrollar escala con el tamaño del grupo: cada integrante es responsable de un (1) modelo de datos con su CRUD completo, tanto en el backend como en el frontend.

| Integrantes | Modelos propios | Ejemplo (temática: biblioteca) |
| --- | --- | --- |
| 2 | 2 | `books`, `authors` |
| 3 | 3 | `books`, `authors`, `loans` |

No se computan como modelos propios los requeridos por el diseño de la autenticación (usuarios, sesiones, cuentas, verificaciones).

Si bien el trabajo es grupal, la calificación es individual: cada alumno es evaluado sobre su modelo, sobre los requisitos opcionales que haya implementado y sobre su desempeño en el coloquio.

## 3. Stack tecnológico

La elección de tecnologías es libre, siempre que se respete la arquitectura API REST. Sin perjuicio de ello, se establecen los siguientes requisitos obligatorios:

- Base de datos NoSQL (por ejemplo: MongoDB, Firestore, DynamoDB, CouchDB).
- Lenguaje tipado tanto en backend como en frontend: TypeScript u otro lenguaje con tipado estático (Java, C#, Go, Kotlin, entre otros). No se acepta JavaScript sin tipar.

La cátedra recomienda el siguiente stack, que corresponde al trabajado en clase y sobre el cual se brinda soporte:

| Capa | Tecnología recomendada |
| --- | --- |
| Backend | Node.js, Express, TypeScript, Mongoose, Zod |
| Base de datos | MongoDB Atlas |
| Autenticación | Better Auth |
| Frontend | React, Vite, TypeScript, React Router, React Hook Form, Zod |
| Estado global | Redux Toolkit y RTK Query |
| Despliegue | Render o Vercel |

## 4. Requisitos obligatorios

El cumplimiento completo de los requisitos de esta sección es condición necesaria para la aprobación y otorga la calificación de cuatro (4). La ausencia de cualquiera de ellos implica la desaprobación del integrante.

### 4.1. Repositorio y metodología de trabajo

- Repositorio en GitHub (monorepo con `backend/` y `frontend/`, o dos repositorios independientes), con todos los integrantes registrados como colaboradores.
- Todo cambio debe incorporarse mediante Pull Request a la rama `main`, acompañado de una descripción de lo realizado: qué se agregó o modificó y cómo verificarlo. No se admiten commits directos sobre `main`.
- Historial de commits granular, con mensajes descriptivos. No se acepta un único commit final.
- Cada integrante debe contar con Pull Requests propios que abarquen el backend y el frontend de su modelo.
- Ningún secreto versionado: archivos `.env`, claves de API o cadenas de conexión con credenciales no deben figurar en el repositorio, incluso en commits anteriores.
- Archivo `.env.example` con la totalidad de las variables de entorno requeridas, sin valores reales.

### 4.2. README profesional

El repositorio debe incluir un `README.md` redactado con criterio profesional, correcta ortografía y formato consistente, que permita a un tercero comprender, ejecutar y evaluar el proyecto sin asistencia del equipo. Debe contener, como mínimo:

- Nombre del proyecto y descripción funcional de la aplicación.
- Integrantes del grupo y modelo a cargo de cada uno.
- Stack tecnológico utilizado y breve descripción de la arquitectura.
- Requisitos previos e instrucciones de instalación y ejecución en entorno local.
- Descripción de las variables de entorno.

### 4.3. Backend

- Un modelo por integrante, con un mínimo de cuatro (4) atributos de al menos tres (3) tipos distintos (texto, número, fecha, booleano, etc.).
- API RESTful con CRUD completo por cada modelo, según la siguiente convención:

| Acción | Método | Ruta |
| --- | --- | --- |
| Listar | GET/QUERY | `/api/<recurso>` |
| Obtener por identificador | GET | `/api/<recurso>/:id` |
| Crear | POST | `/api/<recurso>` |
| Modificar | PUT / PATCH | `/api/<recurso>/:id` |
| Eliminar | DELETE | `/api/<recurso>/:id` |

- Baja lógica y baja física según corresponda en cada modelo.
- Validación de los datos de entrada en las operaciones de alta y modificación, con respuestas 400 y mensajes de error claros.
- Uso correcto de los códigos de estado HTTP: 201 (creado), 400 (datos inválidos), 401 (sin sesión), 403 (sin permisos) y 404 (recurso inexistente).
- Registro, inicio y cierre de sesión de usuarios, con usuarios y sesiones persistidos en la base de datos.
- Roles `user` y `admin`. Todo usuario registrado recibe por defecto el rol `user`.

### 4.4. Frontend

- Ruta pública que visualice datos obtenidos desde el backend.
- Inicio de sesión y registro con validaciones y mensajes de error visibles (campos vacíos, credenciales inválidas).
- Cierre de sesión con redirección a la página de inicio.
- Ruta privada de administración con el CRUD de cada modelo: listado, alta, modificación y eliminación.
- Las operaciones realizadas en el CRUD deben reflejarse en la vista pública.
- Ventana modal de confirmación previa a toda eliminación, con opciones para cancelar o confirmar.
- El acceso por URL a una ruta privada sin sesión iniciada debe redirigir al inicio de sesión. Un usuario con rol `user` no debe poder acceder al panel de administración.
- Formularios con validación del lado del cliente.
- Manejo de estado global, con la librería que el grupo considere adecuada.

### 4.5. Despliegue

- Frontend y backend desplegados en la nube y accesibles mediante URL pública. El proveedor es de libre elección (Render, Vercel, Railway, Netlify, Fly.io, entre otros).
- Base de datos NoSQL alojada en la nube.
- Autenticación operativa en el entorno productivo.
- Datos de ejemplo cargados en todos los modelos: la vista pública no puede encontrarse vacía al momento de la corrección.

### 4.6. Coloquio

Cada integrante deberá exponer el flujo de datos de su modelo de extremo a extremo (formulario, estado, ruta, middleware, controlador y base de datos) y responder consultas sobre el modelo de otro integrante del grupo.

## 5. Requisitos opcionales

Con la totalidad de los requisitos obligatorios se obtiene la calificación de cuatro (4). Cada requisito opcional suma un (1) punto al integrante que lo haya implementado, lo cual se verifica a través de la autoría de los Pull Requests, hasta un máximo de diez (10). Cuando un requisito opcional sea de alcance grupal, el punto se otorga a cada integrante que acredite Pull Requests en su implementación.

| Requisito opcional | Alcance esperado | Puntos |
| --- | --- | --- |
| Inicio de sesión con Google | Operativo en el entorno productivo, con la URL de callback correspondiente al despliegue. | +1 |
| Paginación | En el listado de su modelo, implementada en backend (`?page=&limit=`) y frontend. | +1 |
| Panel de administración de sesiones y permisos | El administrador puede listar usuarios, modificar roles y consultar o revocar sesiones activas. | +1 |
| Agente LLM integrado | Interfaz conversacional en el frontend con un agente (por ejemplo, LangChain) que consulte los datos de la aplicación mediante herramientas. | +1 |
| API documentada con Swagger 2.0 | Especificación de la totalidad de los endpoints, servida desde el backend (por ejemplo, `/api/docs`). | +1 |
| Imágenes en almacenamiento externo | Carga de imágenes en un servicio de almacenamiento de objetos (Amazon S3, Cloudflare R2 o equivalente), persistiendo en la base únicamente la URL. | +1 |

El requisito de imágenes aplica únicamente cuando la temática del proyecto lo justifica.

## 6. Evaluación

La calificación es individual. La corrección se realiza sobre las URLs desplegadas y sobre el repositorio, utilizando el navegador Google Chrome, conforme al siguiente procedimiento:

1. Acceso al frontend desplegado y verificación de que la vista pública presenta datos existentes en la base de datos.
2. Registro de un usuario nuevo y verificación de la asignación del rol `user`.
3. Inicio de sesión con datos erróneos (credenciales inválidas, campos vacíos) y verificación de los mensajes de error.
4. Inicio de sesión con rol `user` y verificación de que no es posible acceder al panel de administración.
5. Inicio de sesión con rol `admin`: listado, alta, modificación y eliminación en cada modelo, verificando el impacto en la base de datos y en la vista pública.
6. Eliminación de registros: verificación de la ventana modal (cancelar y confirmar), de la baja lógica y de la baja física.
7. Cierre de sesión con redirección a la página de inicio y verificación de que el acceso por URL a rutas privadas redirige al inicio de sesión.
8. Revisión del repositorio: calidad del código, README, `.env.example`, ausencia de secretos y Pull Requests con descripción y autoría.
9. Coloquio individual.
10. Verificación de los requisitos opcionales implementados por cada integrante.

### Causales de desaprobación

Implican la desaprobación de todo el grupo:

- Secretos versionados en el repositorio, incluso en commits anteriores.
- Aplicación no desplegada o autenticación no operativa en el entorno productivo.
- Base de datos no NoSQL o código sin tipado.
- Reproducción del CRUD desarrollado en clase con modificaciones meramente nominales.

Implican la desaprobación del integrante, sin afectar al resto del grupo:

- Ausencia de Pull Requests propios.
- Imposibilidad de explicar el funcionamiento de lo desarrollado durante el coloquio.

## 7. Entrega

La entrega se realiza por correo electrónico, con una anticipación mínima de una (1) semana respecto de la fecha de la mesa de examen. Las entregas fuera de término no serán consideradas para dicha mesa.

| Campo | Valor |
| --- | --- |
| Destinatario | tomas.ariaskarle@uai.edu.ar |
| Con copia (CC) | tomas.arias2001@gmail.com |
| Asunto | `TP Final MDW TM - <Apellido y nombre de cada integrante>` |

El cuerpo del correo debe incluir:

1. Nombre, apellido de cada integrante.
2. Enlace al repositorio (o a ambos repositorios).
3. URL del frontend desplegado.
4. Usuarios de prueba con sus contraseñas (uno `admin` y uno `user`).
5. Detalle del modelo y de los requisitos opcionales implementados por cada integrante.

### Lista de verificación previa a la entrega

- [ ] Registro, inicio y cierre de sesión funcionan en el entorno productivo.
- [ ] Un usuario recién registrado recibe el rol `user`.
- [ ] El usuario `admin` de prueba puede crear, modificar y eliminar registros en todos los modelos.
- [ ] El usuario `user` de prueba recibe 403 al intentar operaciones de escritura y no accede al panel de administración.
- [ ] Todos los cambios fueron incorporados mediante Pull Request con descripción.
- [ ] El comando `git log --all -- "*.env"` no devuelve resultados.
