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

Construidas la librería de componentes (Linear PRO-54), la pantalla de inicio **Tareas del día** (PRO-14) y la **barra de navegación** (PRO-18). Clientes, Ficha, Ventas, Equipo y Perfil existen como destinos de navegación con un marcador que nombra su issue.

> ⚠️ **No desplegar en público todavía.** No hay login: la sesión es simulada (`src/lib/session.tsx`) y las funciones de Convex no comprueban identidad. Hasta **PRO-6** esto es solo demo local. Las queries de la sesión simulada fallan cerradas fuera de desarrollo (ver más abajo).

## Empezar a desarrollar

```bash
npm install          # si no lo has hecho ya
cp .env.local.example .env.local
npx convex dev        # primera vez: pide iniciar sesión en Convex y crea/enlaza el proyecto;
                       # deja el proceso corriendo en una terminal aparte (sincroniza el esquema
                       # y regenera convex/_generated en cada cambio)

# Variables del deployment de dev (una sola vez; `convex env set` apunta a dev
# salvo que pases --prod, así que producción no las hereda):
npx convex env set PERMITIR_SESION_SIMULADA true   # habilita usuarios.listar / porEmail
npx convex env set PERMITIR_SEED true              # habilita el seed (es destructivo)
npx convex run seed:cargar                          # datos de demo, con fechas relativas a hoy

npm run dev            # en otra terminal
```

Abre [http://localhost:3000](http://localhost:3000) — redirige a `/hoy`.

Sin `NEXT_PUBLIC_CONVEX_URL` la app muestra un aviso de "Convex no configurado" en lugar de las pantallas: `useQuery` lanza una excepción si no hay proveedor, así que no se monta nada que dependa de datos (`src/components/ConvexClientProvider.tsx`).

En la barra lateral hay un selector **Usuario (dev)** para cambiar de identidad y comprobar el control por rol (la pestaña *Equipo* solo la ve la dueña). Desaparece con PRO-6.

## Estructura

```
convex/            Esquema y funciones de Convex (queries/mutations)
  schema.ts         Las 5 entidades del MVP (crm-mvp M1 / Linear PRO-5)
  usuarios.ts       Sesión simulada — con guard de entorno, se va con PRO-6
  seguimientos.ts   Pendientes del equipo + marcar hecho (PRO-14)
  seed.ts           Datos de demo, destructivo, solo dev
src/
  app/
    (app)/          Grupo de rutas con el shell común (no añade segmento a la URL)
  components/
    ui/             Design system portado a React (PRO-54)
    layout/         AppShell, navegación y placeholders (PRO-18)
    hoy/            Pantalla Tareas del día (PRO-14)
  lib/              session, fechas, estadoCliente y utilidades
Design/             Design system y prototipo de referencia (no tocar desde la app)
```

## Convenciones

- Idioma de la UI: español.
- Seguir los tokens y componentes de `Design/design.md` — no introducir colores, radios o sombras ad-hoc.
- El campo `estado` del Cliente se calcula siempre a partir de sus ventas (ver Linear PRO-17); nunca debe exponerse como campo editable en un formulario.

## Despliegue

> ## ⛔ El despliegue público está bloqueado hasta PRO-6
>
> No hay login. `convex/seguimientos.ts` expone queries y mutations públicas sin
> comprobar identidad, así que **cualquiera que abra la URL vería los
> seguimientos del negocio y podría completarlos**. Las funciones de
> `usuarios.ts` sí fallan cerradas fuera de desarrollo, pero eso no cubre lo
> anterior.
>
> Railway está conectado a GitHub con despliegue automático: **un push a
> `master` publica**. Antes del primer push hay que decidir conscientemente qué
> pasa con ese despliegue (ver "Antes del primer push").

- **GitHub**: `https://github.com/ivanguzmantrader/mi-crm` (rama `master`).
- **Railway**: `railway.json` fija el build, el arranque y el healthcheck; Nixpacks resuelve el resto a partir de `package.json` y `.nvmrc`.

### Cómo encaja Convex en el build

El build de Next **incrusta** `NEXT_PUBLIC_CONVEX_URL` en el bundle, así que tiene que existir en el momento de compilar, y las funciones de Convex tienen que estar publicadas en el deployment de producción. Ambas cosas las resuelve un único comando, que es el que corre Railway:

```bash
npm run build:railway
# → convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "npm run build"
```

`convex deploy` publica el esquema y las funciones en producción y expone la URL resultante al build de Next. Es decir: **no hay que definir `NEXT_PUBLIC_CONVEX_URL` a mano en Railway**; se deriva de la clave de despliegue.

Variables a definir en Railway:

| Variable | Valor |
|---|---|
| `CONVEX_DEPLOY_KEY` | Clave de producción (Convex → Settings → Deploy keys) |

Y las que **no** deben existir en el deployment de producción de Convex: `PERMITIR_SESION_SIMULADA` y `PERMITIR_SEED`. Sin ellas, la sesión simulada y el seed destructivo se niegan a ejecutarse.

> ⚠️ No ejecutes `npm run build:railway` en tu máquina: con `CONVEX_DEPLOYMENT` presente en `.env.local`, `convex deploy` apunta al deployment de **producción**. En local se usa `npx convex dev`.

### Antes del primer push

1. Decidir qué hacer con el despliegue automático mientras no exista PRO-6 — lo más simple es pausar el servicio en Railway, o no darle `CONVEX_DEPLOY_KEY` todavía (sin ella el build falla y no se publica nada).
2. Comprobar que la rama que Railway observa es la que se va a empujar (`master`).
3. `npm run typecheck && npm run lint && npm run build` en local.
