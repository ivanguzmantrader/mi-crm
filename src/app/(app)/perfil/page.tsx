import type { Metadata } from "next";
import { PantallaPerfil } from "@/components/perfil/PantallaPerfil";

export const metadata: Metadata = {
  title: "Mi cuenta · Vibe CRM",
};

export default function PerfilPage() {
  return <PantallaPerfil />;
}
