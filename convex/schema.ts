import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Esquema del MVP (crm-mvp, milestone M1 — ver Linear PRO-5 y el PRD de
 * Notion "CRM - PRD" § Datos). Cubre las 5 entidades: Usuario, Cliente,
 * Interacción, Seguimiento, Venta.
 *
 * Los campos de fase 2 (Prioridad del cliente, etapa de embudo, plantillas
 * de mensajes, suscripciones...) se añaden al abordar el proyecto Linear
 * "CRM - resto PRD" (R1-R6) — no están aquí todavía.
 */
export default defineSchema({
  // Tablas de Convex Auth: `users` (credencial), `authAccounts`, `authSessions`…
  // Guardan la identidad; el perfil de negocio sigue en `usuarios`.
  ...authTables,

  usuarios: defineTable({
    nombre: v.string(),
    // Siempre normalizado a minúsculas (ver normalizarEmail en validaciones.ts):
    // este mismo valor es el `account.id` de la credencial.
    email: v.string(),
    // "propietaria" (Dueña) | "comercial" (Atiende y vende)
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
    /**
     * Enlace con la credencial de Convex Auth.
     *
     * Es opcional porque una persona puede existir como perfil antes de tener
     * contraseña — es el estado intermedio del arranque y el que producirá
     * PRO-8 al dar de alta a alguien.
     *
     * La relación debe ser **1:1**, y hay que imponerlo a mano: los índices de
     * Convex no son únicos, así que este índice no impide dos filas apuntando
     * al mismo `users`. Si eso ocurriera, `usuarioActual()` devolvería una
     * identidad —y un rol— ambiguos.
     */
    authUserId: v.optional(v.id("users")),
  })
    .index("por_email", ["email"])
    .index("por_authUser", ["authUserId"]),

  clientes: defineTable({
    nombre: v.string(),
    // Al menos uno de telefono/email es obligatorio (se valida en la mutation,
    // no en el esquema).
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    empresa: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(
        v.literal("web"),
        v.literal("redes"),
        v.literal("email"),
        v.literal("whatsapp"),
      ),
    ),
    nota: v.optional(v.string()),
    fechaAlta: v.string(), // ISO date (YYYY-MM-DD)
    // Calculado siempre a partir de las ventas del cliente (PRO-17).
    // No debe exponerse como campo editable en ningún formulario de cliente.
    estado: v.union(
      v.literal("nuevo_lead"),
      v.literal("en_negociacion"),
      v.literal("ganado"),
      v.literal("perdido"),
    ),
  }).index("por_estado", ["estado"]),

  interacciones: defineTable({
    clienteId: v.id("clientes"),
    autorId: v.id("usuarios"),
    fecha: v.string(), // ISO date
    canal: v.union(
      v.literal("llamada"),
      v.literal("email"),
      v.literal("whatsapp"),
      v.literal("en_persona"),
    ),
    texto: v.string(),
  }).index("por_cliente", ["clienteId"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    responsableId: v.id("usuarios"),
    accion: v.string(),
    vence: v.string(), // ISO date
    hecho: v.boolean(),
    fechaHecho: v.optional(v.string()),
  })
    .index("por_cliente", ["clienteId"])
    .index("por_hecho", ["hecho"]),

  ventas: defineTable({
    clienteId: v.id("clientes"),
    autorId: v.id("usuarios"),
    concepto: v.string(),
    importe: v.number(),
    estado: v.union(v.literal("abierta"), v.literal("ganada"), v.literal("perdida")),
    fecha: v.string(), // ISO date
  }).index("por_cliente", ["clienteId"]),
});
