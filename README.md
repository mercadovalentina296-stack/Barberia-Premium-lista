# Barbería Premium

Sistema web para organizar los servicios y los turnos de una barbería. Este proyecto se trabajó con HTML, CSS, JavaScript, Node.js, Express y Supabase, siguiendo los requisitos del segundo cuatrimestre.

## Qué se puede hacer

- Crear una cuenta e iniciar sesión con Supabase Auth.
- Consultar los servicios disponibles y sus precios.
- Solicitar un turno eligiendo servicio, fecha y horario.
- Consultar las reservas propias y cancelar una reserva.
- Desde el panel administrador, consultar las reservas y cambiar su estado; también revisar y aprobar opiniones.
- Crear, editar y desactivar servicios.
- Enviar opiniones para que puedan ser aprobadas u ocultadas desde el panel administrador.

## Tecnologías

- Frontend: HTML5, CSS3 y JavaScript (Fetch API).
- Backend: Node.js y Express.
- Base de datos: PostgreSQL en Supabase.
- Autenticación: Supabase Auth.
- Publicación: Vercel.
- Control de versiones: Git y GitHub.

## Carpetas principales

```text
Barberia-Premium/
├── public/
│   ├── css/styles.css
│   ├── js/main.js
│   ├── js/api.js
│   ├── index.html
│   ├── crear.html
│   ├── editar.html
│   ├── registro.html
│   ├── inicioSesion.html
│   ├── reservas.html
│   ├── misReserva.html
│   └── admin.html
├── api/
│   ├── config.js
│   ├── index.js
│   ├── server.js
│   └── supabase.js
├── database/schema.sql
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

## 1. Configurar Supabase

1. Crear un proyecto en [Supabase](https://supabase.com/).
2. Entrar en **SQL Editor**.
3. Abrir el archivo `database/schema.sql`, copiar todo su contenido y ejecutarlo.
4. En **Project Settings > API** copiar el Project URL y la clave `anon` / `publishable` correspondiente.
5. Crear el archivo `.env` en la carpeta principal copiando el contenido de `.env.example` y completar los valores:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

No subir el archivo `.env` a GitHub. La clave `service_role` no se utiliza en este proyecto y nunca debe ponerse en el navegador ni compartirse.

### Acceso al panel de administrador

1. Crear una cuenta normalmente desde **Registrarse** y confirmar el correo.
2. En Supabase abrir **Table Editor > profiles**.
3. Buscar la fila correspondiente al correo/usuario que administrará la barbería.
4. Cambiar únicamente el campo `role` de `client` a `admin` y guardar.
5. Cerrar sesión en la página e iniciar sesión nuevamente con esa cuenta.
6. Al volver a la web aparecerá el enlace **Administrador** en el menú. También se puede abrir `http://localhost:3000/admin.html` después de iniciar sesión.

La página y las operaciones administrativas se validan en el servidor. Una cuenta común no puede gestionar reservas ni servicios. El registro público siempre crea usuarios con rol `client`; no agregues un selector de rol al formulario.

## 2. Ejecutar en la computadora

Tener instalado Node.js (versión 20 o superior).

```bash
npm install
```

Crear el `.env` y completar las credenciales de Supabase. Después ejecutar:

```bash
npm start
```

Si aparece `EADDRINUSE` para el puerto 3000, el servidor ya está iniciado en otra terminal; no hace falta abrir una segunda instancia.

Abrir en el navegador: `http://localhost:3000`.

## 3. Publicar en GitHub

Desde la terminal, ubicada en la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Proyecto Barbería Premium con backend y Supabase"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

Si el repositorio ya tiene un remoto configurado, no volver a ejecutar `git remote add origin`.

## 4. Publicar en Vercel

1. Importar el repositorio de GitHub en Vercel.
2. En **Settings > Environment Variables** agregar `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
3. Realizar el Deploy.
4. Probar el registro, inicio de sesión, carga de servicios y reservas desde el enlace publicado.

En Supabase Auth, configurar las URLs permitidas del sitio publicado en **Authentication > URL Configuration**. Agregar también la dirección local durante las pruebas.

## Importante antes de la entrega

- El proyecto incluye el código para conectar Supabase, pero cada grupo debe crear su propio proyecto y colocar sus credenciales.
- Los precios iniciales de los servicios son valores de ejemplo que se pueden cambiar desde el panel.
- La disponibilidad se protege con una restricción única para que no se asignen dos reservas activas al mismo día y horario.
- Las opiniones quedan pendientes de aprobación antes de mostrarse públicamente.
- La cuenta administradora debe habilitarse manualmente desde Supabase.
- Para la publicación final, verificar el dominio, las variables de entorno y las pruebas en Vercel.


## Comprobaciones realizadas

- Se verificó la sintaxis de los archivos JavaScript del servidor y del navegador con `npm run check`.
- Se inició el servidor local y se comprobó que `/api/health` responde correctamente y que la página principal se sirve con HTTP 200.
- Las operaciones que requieren Supabase (registro, acceso, reservas y administración) necesitan que completes las variables del archivo `.env` y ejecutes `database/schema.sql` en tu propio proyecto. No se incluyen credenciales privadas en el ZIP.
