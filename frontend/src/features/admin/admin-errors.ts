import { ProblemDetailsError } from '../../api/problem-details';

export type AdminContext = 'crear-usuario' | 'roles' | 'crear-vuelo' | 'editar-vuelo' | 'eliminar-vuelo' | 'cancelar-vuelo' | 'reprogramar-vuelo';

/**
 * Specific Spanish text for the 409/422 answers of the back office. Returns undefined when the generic
 * message of the problem code is good enough.
 */
export function adminErrorMessage(error: unknown, context: AdminContext): string | undefined {
  if (!(error instanceof ProblemDetailsError)) return undefined;
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
