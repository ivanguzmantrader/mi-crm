import { redirect } from "next/navigation";

/**
 * "Tareas del día" es la pantalla de inicio de toda la app (PRO-14). Cuando
 * exista el login (PRO-6), redirigirá aquí tras iniciar sesión.
 */
export default function Home() {
  redirect("/hoy");
}
