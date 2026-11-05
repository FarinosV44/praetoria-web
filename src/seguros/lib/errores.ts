/** No existe o el usuario no tiene permiso: se responde igual (404) para no revelar qué existe. */
export class NoEncontrado extends Error {
  constructor(que = 'registro') { super(`No se ha encontrado el ${que}.`); this.name = 'NoEncontrado'; }
}

/** Error de validación con mensajes por campo, pensado para mostrarse en el formulario. */
export class Invalido extends Error {
  constructor(public campos: Record<string, string>, mensaje = 'Revisa los datos marcados.') { super(mensaje); this.name = 'Invalido'; }
}

export class Prohibido extends Error {
  constructor(mensaje = 'No tienes permiso para esta acción.') { super(mensaje); this.name = 'Prohibido'; }
}
