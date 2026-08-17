import type { Metadata } from "next";
import { PantallaHoy } from "@/components/hoy/PantallaHoy";

export const metadata: Metadata = {
  title: "Hoy · Vibe CRM",
};

export default function HoyPage() {
  return <PantallaHoy />;
}
