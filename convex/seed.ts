import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { exigirFechaISO, normalizarEmail } from "./validaciones";

/**
 * Datos de demostración, portados del prototipo de `Design/`.
 *
 * ⚠️ DESTRUCTIVO: borra las 5 tablas antes de insertar. Dos capas de
 * protección:
 *   1. Es `internalMutation`, así que no es invocable desde el cliente.
 *   2. Exige `PERMITIR_SEED=true`, una variable de entorno **por deployment**.
 *      `npx convex env set` apunta a dev por defecto (tocar producción exige
 *      `--prod` explícito), así que se activa una vez en dev y producción nunca
 *      la tiene. El seed se niega a correr salvo permiso expreso, en vez de
 *      intentar adivinar en qué entorno está.
 *
 * Uso:
 *   npx convex env set PERMITIR_SEED true
 *   npx convex run seed:cargar
 */
export const cargar = internalMutation({
  args: {
    /**
     * Ancla de fechas en formato YYYY-MM-DD. Por defecto la fecha del servidor
     * (UTC). Pásala si tu zona horaria hace que el "hoy" del navegador no
     * coincida con la del servidor y quieres que el bloque "Para hoy" cuadre.
     */
    hoy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (process.env.PERMITIR_SEED !== "true") {
      throw new Error(
        "seed:cargar está desactivado en este deployment. Es destructivo (borra todas las tablas). " +
          "Actívalo solo en desarrollo con: npx convex env set PERMITIR_SEED true",
      );
    }

    await vaciar(ctx);

    const ancla =
      args.hoy === undefined
        ? new Date().toISOString().slice(0, 10)
        : exigirFechaISO(args.hoy, "hoy");
    const d = (dias: number) => desplazar(ancla, dias);

    // — Usuarios ————————————————————————————————————————————————
    // Se respetan los existentes en vez de recrearlos: desde PRO-6 llevan
    // enlazada una credencial (`authUserId`), y borrarlos la dejaría huérfana —
    // la persona no podría entrar y la app la echaría al login.
    const marta = await asegurarUsuario(ctx, {
      nombre: "Marta López",
      email: "marta@acme.es",
      rol: "propietaria",
    });
    const carlos = await asegurarUsuario(ctx, {
      nombre: "Carlos Ruiz",
      email: "carlos@betadigital.com",
      rol: "comercial",
    });
    await asegurarUsuario(ctx, {
      nombre: "Lucía Marín",
      email: "lucia@epsilonweb.com",
      rol: "comercial",
    });

    // — Clientes —————————————————————————————————————————————————
    // Nombres deliberadamente distintos de los de los usuarios: en el prototipo
    // coincidían y confundía el avatar del cliente con el del responsable.
    // `estado` se rellena más abajo, ya derivado de las ventas.
    const clientes = {
      acme: await ctx.db.insert("clientes", {
        nombre: "Elena Ferrer",
        empresa: "Acme S.L.",
        email: "elena@acme.es",
        telefono: "+34 600 112 233",
        canalOrigen: "web",
        fechaAlta: d(-58),
        estado: "nuevo_lead",
      }),
      beta: await ctx.db.insert("clientes", {
        nombre: "Javier Soler",
        empresa: "Beta Digital",
        email: "javier@betadigital.com",
        telefono: "+34 611 445 667",
        canalOrigen: "redes",
        fechaAlta: d(-41),
        estado: "nuevo_lead",
      }),
      gamma: await ctx.db.insert("clientes", {
        nombre: "Nuria Vega",
        empresa: "Gamma Studio",
        email: "nuria@gammastudio.io",
        telefono: "+34 622 778 990",
        canalOrigen: "web",
        nota: "Llegó por el formulario de la web tras leer el blog.",
        fechaAlta: d(-4),
        estado: "nuevo_lead",
      }),
      delta: await ctx.db.insert("clientes", {
        nombre: "Diego Sanz",
        empresa: "Delta Comercio",
        email: "diego@deltacomercio.es",
        telefono: "+34 633 221 100",
        canalOrigen: "email",
        fechaAlta: d(-96),
        estado: "nuevo_lead",
      }),
      epsilon: await ctx.db.insert("clientes", {
        nombre: "Rocío Prats",
        empresa: "Epsilon Web",
        email: "rocio@epsilonweb.com",
        telefono: "+34 644 556 677",
        canalOrigen: "whatsapp",
        fechaAlta: d(-23),
        estado: "nuevo_lead",
      }),
      zeta: await ctx.db.insert("clientes", {
        nombre: "Pablo Ortega",
        empresa: "Zeta Retail",
        email: "pablo@zetaretail.es",
        telefono: "+34 655 889 001",
        canalOrigen: "redes",
        fechaAlta: d(-77),
        estado: "nuevo_lead",
      }),
    };

    // — Ventas ———————————————————————————————————————————————————
    const ventas = [
      { clienteId: clientes.delta, autorId: carlos, concepto: "Licencia anual Enterprise", importe: 21000, estado: "ganada" as const, fecha: d(-13) },
      { clienteId: clientes.acme, autorId: marta, concepto: "Servicio de configuración inicial", importe: 1200, estado: "ganada" as const, fecha: d(-18) },
      { clienteId: clientes.delta, autorId: carlos, concepto: "Formación del equipo", importe: 1500, estado: "abierta" as const, fecha: d(-32) },
      { clienteId: clientes.beta, autorId: carlos, concepto: "Plan de suscripción anual", importe: 8900, estado: "abierta" as const, fecha: d(-8) },
      { clienteId: clientes.epsilon, autorId: carlos, concepto: "Paquete de automatización", importe: 5750, estado: "abierta" as const, fecha: d(-7) },
      { clienteId: clientes.zeta, autorId: carlos, concepto: "Consultoría inicial", importe: 1900, estado: "perdida" as const, fecha: d(-29) },
    ];
    for (const venta of ventas) await ctx.db.insert("ventas", venta);

    // El Estado del cliente se deriva SIEMPRE de sus ventas (PRO-17). Se calcula
    // aquí para que el seed no contradiga a PRO-17 cuando se implemente.
    for (const clienteId of Object.values(clientes)) {
      const suyas = ventas.filter((v) => v.clienteId === clienteId);
      await ctx.db.patch(clienteId, {
        estado: estadoDesdeVentas(suyas.map((v) => v.estado)),
      });
    }

    // — Seguimientos ——————————————————————————————————————————————
    // Fechas relativas al ancla, no fijas: los tres bloques (Atrasados / Para
    // hoy / Próximas) tienen que quedar poblados se ejecute el seed cuando se
    // ejecute.
    const seguimientos = [
      { clienteId: clientes.acme, responsableId: marta, accion: "Llamar para cerrar la propuesta", vence: d(-3), hecho: false },
      { clienteId: clientes.gamma, responsableId: marta, accion: "Llamar para el primer contacto", vence: d(-2), hecho: false },
      { clienteId: clientes.beta, responsableId: carlos, accion: "Enviar el contrato para la firma", vence: d(-1), hecho: false },
      { clienteId: clientes.epsilon, responsableId: carlos, accion: "Preparar y enviar la demo", vence: d(0), hecho: false },
      { clienteId: clientes.delta, responsableId: carlos, accion: "Confirmar la renovación del contrato", vence: d(0), hecho: false },
      { clienteId: clientes.beta, responsableId: carlos, accion: "Recordatorio de firma por email", vence: d(0), hecho: false },
      { clienteId: clientes.gamma, responsableId: carlos, accion: "Enviar propuesta comercial", vence: d(1), hecho: false },
      { clienteId: clientes.zeta, responsableId: marta, accion: "Revisar si retoma el proyecto", vence: d(4), hecho: false },
      { clienteId: clientes.acme, responsableId: marta, accion: "Enviar la propuesta inicial", vence: d(-5), hecho: true, fechaHecho: d(-5) },
      { clienteId: clientes.epsilon, responsableId: carlos, accion: "Primera llamada de descubrimiento", vence: d(-6), hecho: true, fechaHecho: d(-6) },
    ];
    for (const seg of seguimientos) await ctx.db.insert("seguimientos", seg);

    // — Interacciones —————————————————————————————————————————————
    const interacciones = [
      { clienteId: clientes.acme, autorId: marta, canal: "llamada" as const, texto: "Interesada en el plan anual, pide propuesta con descuento", fecha: d(-3) },
      { clienteId: clientes.acme, autorId: marta, canal: "email" as const, texto: "Enviada propuesta v2 con condiciones revisadas", fecha: d(-5) },
      { clienteId: clientes.acme, autorId: carlos, canal: "en_persona" as const, texto: "Demo del producto con su equipo", fecha: d(-11) },
      { clienteId: clientes.beta, autorId: carlos, canal: "whatsapp" as const, texto: "Confirma que revisa el contrato esta semana", fecha: d(-1) },
      { clienteId: clientes.gamma, autorId: marta, canal: "email" as const, texto: "Escribe preguntando por precios tras ver la web", fecha: d(-2) },
      { clienteId: clientes.delta, autorId: carlos, canal: "llamada" as const, texto: "Cliente satisfecho con la implantación", fecha: d(-14) },
    ];
    for (const inter of interacciones) await ctx.db.insert("interacciones", inter);

    return {
      ancla,
      usuarios: 3,
      clientes: Object.keys(clientes).length,
      ventas: ventas.length,
      seguimientos: seguimientos.length,
      interacciones: interacciones.length,
    };
  },
});

/**
 * Estado del cliente derivado de sus ventas, con la precedencia del prototipo
 * (`CRM Shell.dc.html` › estadoCliente): **una venta abierta manda sobre una
 * ganada**, porque la relación sigue viva. Misma forma que tendrá PRO-17.
 */
function estadoDesdeVentas(
  estados: Array<"abierta" | "ganada" | "perdida">,
): "nuevo_lead" | "en_negociacion" | "ganado" | "perdido" {
  if (estados.length === 0) return "nuevo_lead";
  if (estados.includes("abierta")) return "en_negociacion";
  if (estados.includes("ganada")) return "ganado";
  return "perdido";
}

/** Desplaza una fecha ISO (YYYY-MM-DD) un número de días. */
function desplazar(iso: string, dias: number): string {
  const [a, m, dia] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, dia + dias));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Devuelve el usuario con ese email, creándolo si no existe.
 *
 * Nunca sobrescribe: si la persona ya está, se conserva tal cual — incluido su
 * `authUserId`, que es lo que le permite iniciar sesión.
 */
async function asegurarUsuario(
  ctx: MutationCtx,
  datos: {
    nombre: string;
    email: string;
    rol: "propietaria" | "comercial";
  },
): Promise<Id<"usuarios">> {
  const email = normalizarEmail(datos.email);
  const existente = await ctx.db
    .query("usuarios")
    .withIndex("por_email", (q) => q.eq("email", email))
    .unique();

  if (existente !== null) return existente._id;
  return await ctx.db.insert("usuarios", { ...datos, email });
}

/**
 * Tablas que el seed vacía. **`usuarios` no está**, a propósito: desde PRO-6
 * lleva credenciales enlazadas y borrarla dejaría a la gente sin poder entrar.
 * Los usuarios se gestionan con `bootstrap:crearUsuario` (y con PRO-8 cuando
 * llegue), no aquí.
 */
const TABLAS = [
  "seguimientos",
  "interacciones",
  "ventas",
  "clientes",
] as const;

async function vaciar(ctx: MutationCtx) {
  for (const tabla of TABLAS) {
    const filas = await ctx.db.query(tabla).collect();
    for (const fila of filas) {
      await ctx.db.delete(fila._id as Id<typeof tabla>);
    }
  }
}
