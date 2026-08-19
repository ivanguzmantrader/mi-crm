import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { exigirSesion } from "./autorizacion";
import {
  esEmail,
  exigirFechaCercana,
  exigirFechaISO,
  hoyISOEnServidor,
} from "./validaciones";

/**
 * Clientes del negocio (F1/F2/F3 — PRO-9, PRO-10 y PRO-11).
 *
 * Todas las funciones exigen sesión y **ninguna distingue rol**: los clientes
 * son del negocio, no de quien los creó. Es la misma decisión que en
 * `seguimientos.pendientes` — en un equipo de dos o tres personas lo que se
 * quiere es que nada se pierda, no permisos por registro.
 *
 * `estado` no aparece como argumento en ninguna función de este módulo. Se
 * deriva de las ventas (PRO-17) y el esquema ya avisa de que no debe exponerse
 * como campo editable; no aceptarlo hace que escribirlo a mano sea imposible en
 * vez de simplemente desaconsejado.
 */

type Canal = NonNullable<Doc<"clientes">["canalOrigen"]>;

const CANAL = v.union(
  v.literal("web"),
  v.literal("redes"),
  v.literal("email"),
  v.literal("whatsapp"),
);

/**
 * Los campos que la pantalla posee, compartidos por el alta y la edición.
 *
 * `canalOrigen` es una unión de literales: **`""` no es un valor válido** y una
 * llamada que lo mandara fallaría en la validación de argumentos, antes de
 * llegar al handler, donde `normalizarDatosCliente` ni siquiera podría verlo.
 * Por eso el formulario convierte la opción vacía en `undefined` antes de
 * construir los argumentos (ver `FormularioCliente`), y el contrato de aquí se
 * queda limpio.
 */
const DATOS = {
  nombre: v.string(),
  telefono: v.optional(v.string()),
  email: v.optional(v.string()),
  empresa: v.optional(v.string()),
  canalOrigen: v.optional(CANAL),
  nota: v.optional(v.string()),
};

const LIMITES = {
  nombre: 120,
  empresa: 120,
  telefono: 40,
  email: 200,
  nota: 2000,
} as const;

const ETIQUETA: Record<keyof typeof LIMITES, string> = {
  nombre: "nombre",
  empresa: "empresa",
  telefono: "teléfono",
  email: "email",
  nota: "nota",
};

/**
 * Recorta un campo de texto y lo convierte en ausente si queda vacío.
 *
 * Devolver `undefined` en vez de `""` no es cosmética: un `email: ""` guardado
 * haría que la ficha pintase un `mailto:` a ninguna parte, y que la regla de
 * "al menos teléfono o email" se diera por cumplida siendo mentira.
 *
 * El límite de longitud existe porque Convex tiene un tope de 1 MB por
 * documento: sin él, una nota enorme falla en el `insert` con un error de
 * infraestructura que no le dice nada a quien está rellenando el formulario.
 */
function limpiar(
  valor: string | undefined,
  campo: keyof typeof LIMITES,
): string | undefined {
  if (valor === undefined) return undefined;

  const texto = valor.trim();
  if (texto.length === 0) return undefined;
  if (texto.length > LIMITES[campo]) {
    throw new Error(
      `El ${ETIQUETA[campo]} no puede pasar de ${LIMITES[campo]} caracteres.`,
    );
  }
  return texto;
}

interface DatosEntrada {
  nombre: string;
  telefono?: string;
  email?: string;
  empresa?: string;
  canalOrigen?: Canal;
  nota?: string;
}

interface DatosLimpios {
  nombre: string;
  telefono: string | undefined;
  email: string | undefined;
  empresa: string | undefined;
  canalOrigen: Canal | undefined;
  nota: string | undefined;
}

/**
 * Las reglas del cliente, en un solo sitio para el alta y la edición.
 *
 * Vive extraída y no copiada en cada mutation a propósito: dos copias de una
 * validación divergen en cuanto alguien toca una: es exactamente lo que pasó
 * con `renombrarCredencial` entre PRO-8 y PRO-7.
 *
 * Devuelve **siempre las seis claves**, con `undefined` en las vacías. Eso es
 * lo que permite que `actualizar` use el resultado tal cual como patch y que
 * vaciar un campo lo borre de verdad (ver `actualizar`).
 */
function normalizarDatosCliente(datos: DatosEntrada): DatosLimpios {
  const nombre = limpiar(datos.nombre, "nombre");
  if (nombre === undefined) {
    throw new Error("El nombre es obligatorio.");
  }

  const telefono = limpiar(datos.telefono, "telefono");
  // Sin esto, un "-" en el teléfono satisface "al menos uno de los dos" con un
  // dato que ni sirve para llamar ni encuentra el buscador. No se valida el
  // formato más allá: los teléfonos internacionales varían demasiado y rechazar
  // uno bueno es mucho peor que aceptar uno raro.
  if (telefono !== undefined && !/\d/.test(telefono)) {
    throw new Error("El teléfono debe contener algún número.");
  }

  // Orden importante: `esEmail` no recorta ni pasa a minúsculas, así que se
  // valida sobre el valor ya limpio, nunca sobre lo que llegó del formulario.
  const email = limpiar(datos.email, "email")?.toLowerCase();
  if (email !== undefined && !esEmail(email)) {
    throw new Error("El email no es válido.");
  }

  if (telefono === undefined && email === undefined) {
    throw new Error("Indica al menos un teléfono o un email.");
  }

  return {
    nombre,
    telefono,
    email,
    empresa: limpiar(datos.empresa, "empresa"),
    canalOrigen: datos.canalOrigen,
    nota: limpiar(datos.nota, "nota"),
  };
}

/**
 * Fecha del último contacto de cada cliente, entendiendo por contacto una
 * **interacción**: una venta es un resultado y un seguimiento es un plan,
 * ninguno de los dos es haber hablado con alguien.
 *
 * Un solo escaneo de la tabla agrupado en memoria, en vez de una consulta
 * indexada por cliente dentro de un bucle (que serían N consultas para pintar
 * una lista). A cambio, esta query depende de `interacciones` entera: Convex la
 * reejecuta cuando cambia cualquiera, que es justo lo que se quiere para que el
 * dato se mantenga solo. Si esa tabla crece mucho (M4), la salida es
 * denormalizar `ultimoContacto` en `clientes` al anotar la interacción.
 */
async function ultimosContactos(
  ctx: QueryCtx,
): Promise<Map<Id<"clientes">, string>> {
  const interacciones = await ctx.db.query("interacciones").collect();

  const ultimo = new Map<Id<"clientes">, string>();
  for (const interaccion of interacciones) {
    const previo = ultimo.get(interaccion.clienteId);
    if (previo === undefined || interaccion.fecha > previo) {
      ultimo.set(interaccion.clienteId, interaccion.fecha);
    }
  }
  return ultimo;
}

/**
 * Nombres de las personas citadas en la ficha, resueltos de una vez.
 *
 * Los autores y responsables que ya no existan se quedan fuera del mapa y sus
 * filas los mostrarán como `null`. Es el criterio que ya usa
 * `seguimientos.pendientes`: el nombre solo alimenta una etiqueta, así que una
 * referencia colgante no justifica esconder un apunte del historial.
 */
async function nombresDeUsuarios(
  ctx: QueryCtx,
  ids: Array<Id<"usuarios">>,
): Promise<Map<Id<"usuarios">, string>> {
  const unicos = [...new Set(ids)];
  const filas = await Promise.all(unicos.map((id) => ctx.db.get(id)));

  const nombres = new Map<Id<"usuarios">, string>();
  filas.forEach((fila, i) => {
    if (fila !== null) nombres.set(unicos[i], fila.nombre);
  });
  return nombres;
}

/** Listado completo para la pantalla de Clientes (PRO-10). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    await exigirSesion(ctx);

    const clientes = await ctx.db.query("clientes").collect();
    const ultimo = await ultimosContactos(ctx);

    // El filtrado del buscador ocurre en el navegador (ver PantallaClientes):
    // ningún índice de Convex puede casar "612345678" con "612 34 56 78", y el
    // enunciado pide que la búsqueda se sienta instantánea. A volumen de un
    // negocio pequeño —unos cientos de clientes— es correcto; si creciera,
    // haría falta `paginate()` y mover la búsqueda al servidor.
    return clientes
      .map((cliente) => ({
        _id: cliente._id,
        nombre: cliente.nombre,
        empresa: cliente.empresa ?? null,
        telefono: cliente.telefono ?? null,
        email: cliente.email ?? null,
        estado: cliente.estado,
        fechaAlta: cliente.fechaAlta,
        ultimoContacto: ultimo.get(cliente._id) ?? null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
});

/**
 * Alta de cliente (PRO-9). Devuelve el id para que la pantalla pueda abrir su
 * ficha, que es lo que pide el enunciado: crear y ponerse a trabajar sin pasos
 * intermedios.
 */
export const crear = mutation({
  args: {
    ...DATOS,
    /**
     * Fecha local de quien da de alta (YYYY-MM-DD). Mismo motivo que en
     * `seguimientos.marcarHecho`: el servidor corre en UTC y cerca de medianoche
     * fecharía el alta un día antes o después para cualquiera que no esté en UTC.
     * Y `fechaAlta` no es un dato interno — se enseña en la lista.
     *
     * Se omite en invocaciones desde CLI, donde no hay navegador que la aporte.
     */
    fecha: v.optional(v.string()),
  },
  handler: async (ctx, { fecha, ...datos }) => {
    await exigirSesion(ctx);

    const limpios = normalizarDatosCliente(datos);
    const fechaAlta =
      fecha === undefined
        ? hoyISOEnServidor()
        : exigirFechaCercana(exigirFechaISO(fecha, "fecha"));

    return await ctx.db.insert("clientes", {
      ...limpios,
      fechaAlta,
      // Fijado aquí, no recibido: ver la cabecera del módulo.
      estado: "nuevo_lead",
    });
  },
});

/**
 * Todo lo del cliente en una sola query (PRO-11): datos, seguimientos
 * pendientes e historial ya mezclado y ordenado.
 *
 * Es una y no cuatro para que haya **un único punto de autorización** — con una
 * query por tabla habría cuatro sitios donde olvidar `exigirSesion`— y para que
 * la pantalla no tenga que mezclar ni ordenar. La reactividad no se pierde: al
 * leer las cuatro tablas, completar un seguimiento reejecuta esto solo y la
 * fila salta de "pendientes" a "historial".
 */
export const ficha = query({
  args: {
    /**
     * `v.string()` y no `v.id("clientes")` a propósito. Este id viene de la
     * barra de direcciones, no de un botón nuestro: teclearlo mal es normal y un
     * enlace viejo a un cliente borrado también. Con `v.id` una URL inválida
     * fallaría en la **validación de argumentos**, que en el cliente es una
     * excepción que tumba la pantalla, no un "no encontrado" que se pueda
     * pintar. `normalizeId` convierte ese caso en un `null` normal.
     */
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    await exigirSesion(ctx);

    const clienteId = ctx.db.normalizeId("clientes", id);
    if (clienteId === null) return null;

    const cliente = await ctx.db.get(clienteId);
    if (cliente === null) return null;

    const [interacciones, ventas, seguimientos] = await Promise.all([
      ctx.db
        .query("interacciones")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect(),
      ctx.db
        .query("ventas")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect(),
      ctx.db
        .query("seguimientos")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect(),
    ]);

    const nombres = await nombresDeUsuarios(ctx, [
      ...interacciones.map((i) => i.autorId),
      ...ventas.map((venta) => venta.autorId),
      ...seguimientos.map((s) => s.responsableId),
    ]);

    const pendientes = seguimientos
      .filter((s) => !s.hecho)
      .sort((a, b) => a.vence.localeCompare(b.vence))
      .map((s) => ({
        _id: s._id,
        accion: s.accion,
        vence: s.vence,
        responsableNombre: nombres.get(s.responsableId) ?? null,
      }));

    const historial = [
      ...interacciones.map((i) => ({
        tipo: "interaccion" as const,
        _id: i._id,
        fecha: i.fecha,
        creado: i._creationTime,
        canal: i.canal,
        texto: i.texto,
        autorNombre: nombres.get(i.autorId) ?? null,
      })),
      ...ventas.map((venta) => ({
        tipo: "venta" as const,
        _id: venta._id,
        fecha: venta.fecha,
        creado: venta._creationTime,
        concepto: venta.concepto,
        importe: venta.importe,
        // `estado` a secas: la unión va discriminada por `tipo`, así que aquí no
        // se confunde con el del cliente, que vive en otro objeto.
        estado: venta.estado,
        autorNombre: nombres.get(venta.autorId) ?? null,
      })),
      ...seguimientos
        .filter((s) => s.hecho)
        .map((s) => ({
          tipo: "seguimiento" as const,
          _id: s._id,
          // `fechaHecho` es opcional: las filas anteriores a que se registrara
          // caen a su fecha de vencimiento, que es la mejor aproximación.
          fecha: s.fechaHecho ?? s.vence,
          creado: s._creationTime,
          accion: s.accion,
          responsableNombre: nombres.get(s.responsableId) ?? null,
        })),
      // Las fechas son ISO corto, así que se comparan como cadenas. El desempate
      // por `_creationTime` no es adorno: sin él, dos apuntes del mismo día
      // quedarían en orden de escaneo, que al usuario le parece aleatorio.
    ].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);

    return {
      cliente: {
        _id: cliente._id,
        nombre: cliente.nombre,
        empresa: cliente.empresa ?? null,
        telefono: cliente.telefono ?? null,
        email: cliente.email ?? null,
        canalOrigen: cliente.canalOrigen ?? null,
        nota: cliente.nota ?? null,
        estado: cliente.estado,
        fechaAlta: cliente.fechaAlta,
      },
      pendientes,
      historial,
    };
  },
});

/**
 * Edición de los datos de contacto (PRO-11).
 *
 * **No acepta `estado` ni `fechaAlta`.** El primero se deriva de las ventas; el
 * segundo es un hecho del pasado que no se corrige desde un formulario.
 *
 * **Reescribe siempre los seis campos, y esto es lo delicado.** `ctx.db.patch`
 * borra un campo cuando recibe `undefined`, así que pasarle el juego completo
 * hace que vaciar cualquier opcional lo borre de verdad. Si en cambio se
 * construyera el patch solo con las claves que llegan —que es lo que parece más
 * limpio— quitarle el canal de origen a un cliente **no se lo quitaría**: el
 * campo llegaría ausente, el patch no lo mencionaría y el valor viejo
 * sobreviviría a un "guardar" que dice que sí.
 *
 * Ojo con la asimetría, que es real y no un despiste: al **enviar** argumentos
 * desde el cliente, las claves con `undefined` se descartan (así es como el
 * formulario omite `canalOrigen` sin mandar `""`), mientras que en un **patch**
 * `undefined` significa borrar. Los dos comportamientos hacen falta.
 */
export const actualizar = mutation({
  args: { id: v.id("clientes"), ...DATOS },
  handler: async (ctx, { id, ...datos }) => {
    await exigirSesion(ctx);

    const limpios = normalizarDatosCliente(datos);

    const existente = await ctx.db.get(id);
    if (existente === null) {
      throw new Error("Este cliente ya no existe.");
    }

    await ctx.db.patch(id, limpios);
  },
});
