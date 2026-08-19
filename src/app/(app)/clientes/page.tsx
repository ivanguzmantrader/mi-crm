import type { Metadata } from "next";
import { PantallaClientes } from "@/components/clientes/PantallaClientes";

export const metadata: Metadata = {
  title: "Clientes · Vibe CRM",
};

export default function ClientesPage() {
  return <PantallaClientes />;
}
