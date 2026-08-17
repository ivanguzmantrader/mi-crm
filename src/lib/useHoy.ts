"use client";

import { useSyncExternalStore } from "react";
import { hoyISO } from "./fechas";

/** La fecha no cambia sola durante la sesión: no hay a qué suscribirse. */
const sinSuscripcion = () => () => {};
const sinFechaEnServidor = () => null;

/**
 * "Hoy" según el navegador, o `null` mientras se renderiza en el servidor.
 *
 * Va por `useSyncExternalStore` en vez de un efecto porque es exactamente el
 * caso para el que existe: un valor que solo el cliente conoce. Devolver `null`
 * como instantánea de servidor deja que la pantalla pinte su estado de carga
 * durante la hidratación, sin desajuste y sin renders en cascada.
 */
export function useHoy(): string | null {
  return useSyncExternalStore(sinSuscripcion, hoyISO, sinFechaEnServidor);
}
