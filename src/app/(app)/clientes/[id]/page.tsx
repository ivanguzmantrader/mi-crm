import type { Metadata } from "next";
import { PantallaFicha } from "@/components/clientes/PantallaFicha";

export const metadata: Metadata = {
  title: "Ficha de cliente · Vibe CRM",
};

/**
 * En Next 16 `params` es una **promesa** y hay que esperarla; leer `params.id`
 * directo no da un error claro, da `undefined` colándose hasta la query.
 *
 * La página se queda como componente de servidor —así puede exportar
 * `metadata`— y pasa el id al componente cliente, igual que hace `perfil`.
 */
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PantallaFicha id={id} />;
}
