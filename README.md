# Vibe CRM

CRM para negocios pequeños: clientes, seguimientos y ventas en un solo sitio, para no perder oportunidades por falta de organización.

- **PRD**: Notion — "CRM - PRD" (+ "CRM, cambios y mejoras" para el histórico de cambios).
- **Planificación**: Linear, workspace `proyectosia`, equipo `PRO` — proyectos `crm-mvp` (Fase 0 diseño hecha, M1-M6 construcción) y `CRM - resto PRD` (R0 diseño, R1-R6 construcción, fase 2).
- **Diseño**: [`Design/`](./Design) — `design.md` (design system) y el prototipo hi-fi (`Prototipo del CRM - Claude Design/`). Referencia de comportamiento y estilo, no código a portar literalmente.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind CSS v4).
- **Convex** como base de datos y backend (funciones + tiempo real).
- Despliegue en **Railway**, repositorio en **GitHub**.

## Estado actual

Construidas la librería de componentes (Linear PRO-54), la pantalla de inicio **Tareas del día** (PRO-14), la **barra de navegación** (PRO-18) y el **acceso con email y contraseña** (PRO-6). Clientes, Ficha, Ventas, Equipo y Perfil existen como destinos de navegación con un marcador que nombra su issue.

La autenticación es de verdad: todas las funciones de Convex exigen sesión, y las de la dueña comprueban el rol. **No hay registro público** — las cuentas las crea la dueña (PRO-8) o, mientras esa pantalla no exista, `bootstrap:crearUsuario` por CLI.

Para ver qué queda temporal en el código: `npm run andamiaje`.

## Empezar a desarrollar

> **Al clonar en Windows**: el prototipo de `Design/` incluye rutas de hasta 152
> caracteres, así que si clonas en una carpeta cuya ruta pase de unos 100 el
> checkout falla con *"Filename too long"*. Clona en una ruta corta, o usa
> `git clone -c core.longpaths=true …`. En Linux (Railway) no aplica.

```bash
npm install          # si no lo has hecho ya
cp .env.local.example .env.local
npx convex dev        # primera vez: pide iniciar sesión en Convex y crea/enlaza el proyecto;
                       # deja el proceso corriendo en una terminal aparte (sincroniza el esquema
                       # y regenera convex/_generated en cada cambio)

# Claves de firma de la sesión (una sola vez por deployment):
npx @convex-dev/auth                                # genera y fija JWT_PRIVATE_KEY y JWKS

# Datos de demo (el seed es destructivo, por eso pide permiso explícito):
npx convex env set PERMITIR_SEED true
npx convex run seed:cargar                          # fechas relativas a hoy

# Primera cuenta: no hay registro público, así que hay que sembrarla.
npx convex env set PERMITIR_BOOTSTRAP true
npx convex run bootstrap:crearUsuario '{"nombre":"Marta López","email":"marta@acme.es","password":"…","rol":"propietaria"}'
npx convex env remove PERMITIR_BOOTSTRAP            # retirar en cuanto termines

npm run dev            # en otra terminal
```

Abre [http://localhost:3000](http://localhost:3000) — sin sesión te lleva a `/login`; con ella, a `/hoy`.

Sin `NEXT_PUBLIC_CONVEX_URL` la app muestra un aviso de "Convex no configurado" en lugar de las pantallas: `useQuery` lanza una excepción si no hay proveedor, así que no se monta nada que dependa de datos (`src/components/ConvexClientProvider.tsx`).

> Si al iniciar sesión ves un fallo genérico y en consola aparece `invalid RSA PrivateKeyInfo`, es que `JWT_PRIVATE_KEY` se guardó con saltos de línea. Debe almacenarse en **una sola línea**, con los saltos convertidos en espacios.

## Estructura

```
convex/            Esquema y funciones de Convex (queries/mutations)
  schema.ts         Las 5 entidades del MVP + tablas de Convex Auth
  auth.ts           Proveedor Password; bloquea el alta pública (PRO-6)
  http.ts           Rutas HTTP de auth — sin esto el login no arranca
  autorizacion.ts   exigirSesion / exigirDuena: la autorización de verdad
  usuarios.ts       Perfil de quien llama y listado (solo dueña)
  seguimientos.ts   Pendientes del equipo + marcar hecho (PRO-14)
  bootstrap.ts      Alta de usuarios por CLI hasta que exista PRO-8
  seed.ts           Datos de demo, destructivo, solo dev
  salud.ts          Qué variables tiene puestas un deployment
src/
  proxy.ts          Redirección optimista por sesión (Next 16: antes middleware)
  app/
    login/          Pantalla de acceso (PRO-6)
    (app)/          Grupo de rutas con el shell común (no añade segmento a la URL)
  components/
    ui/             Design system portado a React (PRO-54)
    layout/         AppShell, navegación y placeholders (PRO-18)
    hoy/            Pantalla Tareas del día (PRO-14)
  lib/              session, fechas, estadoCliente y utilidades
scripts/
  andamiaje.mjs     Inventario de lo temporal (npm run andamiaje)
Design/             Design system y prototipo de referencia (no tocar desde la app)
```

## Andamiaje: cómo no volver a acumular deuda a ciegas

Toda pieza temporal lleva `ANDAMIAJE(PRO-XX):` en su comentario y aparece en `npm run andamiaje`. El inventario se genera del código, así que no puede desincronizarse.

Si además toca datos, va detrás de un flag `PERMITIR_*` que producción no tiene: así el "esto no debe correr en producción" deja de ser una nota en un comentario y pasa a ser una garantía. `npx convex run salud:configuracion` dice de un vistazo qué tiene puesto un deployment.

Y una rutina: no cerrar una issue sin ejecutar `npm run andamiaje` y dejar en Linear qué queda stubeado.

## Convenciones

- Idioma de la UI: español.
- Seguir los tokens y componentes de `Design/design.md` — no introducir colores, radios o sombras ad-hoc.
- El campo `estado` del Cliente se calcula siempre a partir de sus ventas (ver Linear PRO-17); nunca debe exponerse como campo editable en un formulario.

## Despliegue

> ## El bloqueo por falta de login ya está levantado
>
> Con PRO-6 todas las funciones de Convex exigen sesión y las de la dueña
> comprueban el rol, así que la app ya se puede publicar. Lo que queda es
> **configurar bien el deployment de producción**: es donde se concentra el
> riesgo, porque son variables por deployment y lo que funciona en dev no se
> hereda.
>
> Railway sigue con el origen de GitHub **desconectado** desde antes de PRO-6
> (ver "Reconectar el despliegue"), así que hoy un push no publica nada.

- **GitHub**: `https://github.com/ivanguzmantrader/mi-crm` (rama `master`).
- **Railway**: `railway.json` fija el build, el arranque y el healthcheck; Nixpacks resuelve el resto a partir de `package.json` y `.nvmrc`.

### Cómo encaja Convex en el build

El build de Next **incrusta** `NEXT_PUBLIC_CONVEX_URL` en el bundle, así que tiene que existir en el momento de compilar, y las funciones de Convex tienen que estar publicadas en el deployment de producción. Ambas cosas las resuelve un único comando, que es el que corre Railway:

```bash
npm run build:railway
# → convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "npm run build"
```

`convex deploy` publica el esquema y las funciones en producción y expone la URL resultante al build de Next. Es decir: **no hay que definir `NEXT_PUBLIC_CONVEX_URL` a mano en Railway**; se deriva de la clave de despliegue.

Variables a definir **en Railway**:

| Variable | Valor |
|---|---|
| `CONVEX_DEPLOY_KEY` | Clave de producción (Convex → Settings → Deploy keys) |

Variables a definir **en el deployment de producción de Convex** (no se heredan de dev):

| Variable | Cómo |
|---|---|
| `JWT_PRIVATE_KEY` | `npx @convex-dev/auth --prod` — **sin esto el login falla solo en producción** |
| `JWKS` | igual que la anterior |

Y las que **no** deben existir en producción: `PERMITIR_SEED` y `PERMITIR_BOOTSTRAP`. Sin ellas, el seed destructivo y el alta por CLI se niegan a ejecutarse. La primera cuenta se crea activando `PERMITIR_BOOTSTRAP` un momento y retirándola justo después.

Antes de publicar, comprobarlo todo de una vez:

```bash
npx convex run salud:configuracion --prod
# auth.*      → deben estar las dos en true
# andamiaje.* → deben estar todas en false
```

> ⚠️ No ejecutes `npm run build:railway` en tu máquina: con `CONVEX_DEPLOYMENT` presente en `.env.local`, `convex deploy` apunta al deployment de **producción**. En local se usa `npx convex dev`.

### Reconectar el despliegue

El servicio `mi-crm` (proyecto Railway `illustrious-love`, entorno `production`) sigue con **el origen de GitHub desconectado**, de cuando no había login. Nunca se ha desplegado: la URL pública responde 404. Mientras siga así, ningún push publica.

Para reactivarlo:

```bash
railway link --project illustrious-love
railway service source connect --repo ivanguzmantrader/mi-crm --branch master --service mi-crm
```

…y definir `CONVEX_DEPLOY_KEY` en las variables del servicio. A partir de ahí, cada push a `master` despliega.

### Antes de reconectar

1. `npm run typecheck && npm run lint && npm run build` en local.
2. Poner `JWT_PRIVATE_KEY` y `JWKS` en el deployment de producción de Convex.
3. `npx convex run salud:configuracion --prod` → auth en true, andamiaje en false.
4. Crear la primera dueña de producción con `bootstrap:crearUsuario`, y retirar `PERMITIR_BOOTSTRAP` acto seguido.
5. Repetir contra producción las comprobaciones que dependen del deployment: que las funciones rechacen sin sesión, que el alta pública falle y que el login funcione. Pasar en local no garantiza nada de eso.
