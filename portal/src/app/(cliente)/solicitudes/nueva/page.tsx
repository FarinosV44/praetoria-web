import { nuevaSolicitud } from '../acciones';
import { requerirCliente } from '@/lib/sesion';

export default async function Nueva() {
  await requerirCliente();
  return (
    <div className="card max-w-xl">
      <h1 className="titulo mb-2">Nueva solicitud</h1>
      <p className="mb-2">Te haremos unas pocas preguntas en cuatro pasos. Puedes guardar y seguir más tarde.</p>
      <p className="ayuda mb-5">Enviar una solicitud no supone que el despacho acepte el encargo: primero la revisaremos.</p>
      <form action={nuevaSolicitud}><button className="btn btn-primario">Empezar</button></form>
    </div>
  );
}
