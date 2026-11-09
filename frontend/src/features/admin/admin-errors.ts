import { ProblemDetailsError } from '../../api/problem-details';

export type AdminContext =
  | 'crear-usuario'
  | 'roles'
  | 'crear-vuelo'
  | 'editar-vuelo'
  | 'eliminar-vuelo'
  | 'cancelar-vuelo'
  | 'reprogramar-vuelo'
  | 'estado-vuelo'
  | 'checkin-reserva'
  | 'cotizar-reserva'
  | 'cancelar-reserva'
  | 'crear-proveedor'
  | 'editar-proveedor'
  | 'apagar-proveedor'
  | 'eliminar-proveedor'
  | 'comprobar-proveedor'
  | 'sincronizar-proveedor'
  | 'reintentar-webhook'
  | 'exportar-reservas';

/**
 * Specific Spanish text for the 409/422 answers of the back office. Returns undefined when the generic
 * message of the problem code is good enough.
 */
export function adminErrorMessage(error: unknown, context: AdminContext): string | undefined {
  if (!(error instanceof ProblemDetailsError)) return undefined;
  const proveedor = providerErrorMessage(error, context);
  if (proveedor) return proveedor;
  const mostrador = counterErrorMessage(error, context);
  if (mostrador) return mostrador;
  if (error.code === 'EMAIL_ALREADY_REGISTERED') return 'Ya existe un usuario con ese correo. Usa otro correo.';
  if (error.code === 'LAST_ADMIN') return 'No se puede quitar el rol: no puedes quitártelo a ti mismo ni dejar el sistema sin administradores.';
  if (error.code === 'FLIGHT_IN_USE') return 'Este vuelo tiene reservas o retenciones, por eso no se puede eliminar. Usa «Cancelar vuelo»: lo cierra a la venta y reembolsa sus reservas.';
  if (error.status === 422) {
    return context === 'crear-vuelo'
      ? 'El origen o el destino no existe en el catálogo de aeropuertos. Elige otro.'
      : 'Algún dato no es válido. Revísalo e intenta de nuevo.';
  }
  if (error.status === 409) {
    switch (context) {
      case 'crear-vuelo':
        return 'Ya existe un vuelo con ese código a esa misma hora. Cambia el código o la hora de salida.';
      case 'editar-vuelo':
        return 'No se pudo editar: la capacidad no puede ser menor que los asientos vendidos o retenidos ni dejar fuera asientos ya asignados, y solo se editan vuelos programados que no hayan salido.';
      case 'cancelar-vuelo':
      case 'reprogramar-vuelo':
        return 'Este vuelo ya no admite esta acción (está cancelado o ya salió). Actualiza la lista.';
      default:
        return undefined;
    }
  }
  return undefined;
}

/** Texts of the counter (bookings and flight status). */
function counterErrorMessage(error: ProblemDetailsError, context: AdminContext): string | undefined {
  switch (context) {
    case 'checkin-reserva':
      if (error.code === 'CHECK_IN_NOT_AVAILABLE') return 'El check-in solo se abre 48 horas antes de la salida (y se cierra al salir el vuelo). Intenta dentro de esa ventana.';
      if (error.code === 'FLIGHT_ALREADY_DEPARTED') return 'El vuelo de esta reserva ya salió: no se puede hacer check-in.';
      if (error.code === 'CHECK_IN_FAILED') return 'No se pudo asignar un asiento (cabina llena o asiento ocupado). Intenta de nuevo.';
      if (error.status === 409) return 'El check-in no está disponible ahora: fuera de la ventana de 48 horas antes de la salida, o la reserva no está confirmada.';
      if (error.status === 404) return 'No existe esta reserva.';
      return undefined;
    case 'cotizar-reserva':
    case 'cancelar-reserva':
      if (error.code === 'CUTOFF_PASSED') return 'La cancelación ya está cerrada para esta reserva (pasó el plazo antes de la salida).';
      if (error.code === 'FLIGHT_ALREADY_DEPARTED') return 'El vuelo de esta reserva ya salió: no se puede cancelar.';
      if (error.code === 'QUOTE_EXPIRED') return 'La cotización venció. Cotiza de nuevo antes de cancelar.';
      if (error.status === 409) return 'Esta reserva ya no se puede cancelar (ya está cancelada o fuera de plazo). Actualiza la lista.';
      if (error.status === 404) return 'No existe esta reserva.';
      return undefined;
    case 'reintentar-webhook':
      if (error.status === 409) return 'Esta entrega ya fue confirmada por el receptor: no se vuelve a enviar.';
      if (error.status === 404) return 'Esta entrega ya no existe. Actualiza la lista.';
      return undefined;
    case 'exportar-reservas':
      if (error.status === 400) return 'Algún filtro no es válido (las fechas van como AAAA-MM-DD). Revísalos e intenta de nuevo.';
      return undefined;
    case 'estado-vuelo':
      if (error.code === 'INVALID_STATUS_TRANSITION') return 'Ese cambio de estado no es válido desde el estado actual del vuelo (por ejemplo, un vuelo que ya salió no vuelve a programado).';
      if (error.status === 400) return 'Un vuelo retrasado necesita la salida estimada. Revisa los datos del formulario.';
      if (error.status === 404) return 'No existe este vuelo para esa fecha.';
      if (error.status === 409) return 'Ese cambio de estado no es válido desde el estado actual del vuelo.';
      return undefined;
    default:
      return undefined;
  }
}

/** Texts of the provider console; undefined for any other context or when the generic message is good enough. */
function providerErrorMessage(error: ProblemDetailsError, context: AdminContext): string | undefined {
  switch (context) {
    case 'crear-proveedor':
    case 'editar-proveedor':
      if (error.status === 409) return 'Ya existe un proveedor con ese nombre. Usa otro nombre.';
      if (error.status === 400 && error.invalidParams.some((p) => p.name === 'baseUrl')) {
        return 'La URL del proveedor fue rechazada. Debe ser una dirección https pública (no una red interna ni localhost).';
      }
      return undefined;
    case 'sincronizar-proveedor':
      if (error.code === 'PROVIDER_ACTION_NOT_SUPPORTED') {
        return 'Solo los proveedores de Atracciones tienen catálogo que importar. Autos y Alojamientos todavía no se sincronizan: es una limitación prevista, no un fallo.';
      }
      if (error.code === 'PROVIDER_DISABLED') return 'El proveedor está apagado. Enciéndelo antes de sincronizar.';
      if (error.code === 'PROVIDER_UNAVAILABLE' || error.status === 503) {
        return 'El proveedor no responde (o su circuito está abierto). Comprueba su estado y vuelve a intentarlo en unos minutos.';
      }
      return undefined;
    case 'comprobar-proveedor':
      if (error.code === 'PROVIDER_DISABLED') return 'El proveedor está apagado: enciéndelo para poder comprobarlo.';
      return undefined;
    case 'eliminar-proveedor':
      if (error.code === 'PROVIDER_IN_USE') return 'Este proveedor ya vendió reservas, por eso no se puede eliminar. Apágalo con el interruptor: deja de ofrecerse sin perder el historial.';
      return undefined;
    default:
      return undefined;
  }
}
