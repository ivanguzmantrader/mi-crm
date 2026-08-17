import { PantallaPendiente } from "@/components/layout/PantallaPendiente";

export default function ClientesPage() {
  return (
    <PantallaPendiente
      titulo="Clientes"
      issue="PRO-10"
      descripcion="Listado de clientes con buscador por nombre, teléfono o email."
    />
  );
}
