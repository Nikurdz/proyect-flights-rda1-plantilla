export type OrderStatusIcon = 'ok' | 'plane' | 'clock' | 'alert';

/** Status of an order as the traveller reads it: tone, icon and what happens next. */
export function orderStatusInfo(status: string): { tone: 'success' | 'warning' | 'danger' | 'outline'; icon: OrderStatusIcon; next: string } {
  switch (status) {
    case 'EMITIDA':
    case 'MODIFICADA':
      return { tone: 'success', icon: 'ok', next: 'Tus billetes están listos.' };
    case 'EN_VIAJE':
      return { tone: 'success', icon: 'plane', next: 'Tu viaje está en curso.' };
    case 'COMPLETADA':
      return { tone: 'outline', icon: 'ok', next: 'Viaje realizado.' };
    case 'PENDIENTE_PAGO':
    case 'PAGO_EN_VERIFICACION':
    case 'PAGADA':
      return { tone: 'warning', icon: 'clock', next: 'Estamos confirmando tu pago. Vuelve a revisar en unos minutos.' };
    case 'DEVOLUCION_EN_CURSO':
      return { tone: 'warning', icon: 'clock', next: 'Tu reembolso está en proceso.' };
    case 'REEMBOLSADA':
      return { tone: 'outline', icon: 'ok', next: 'Te devolvimos el pago.' };
    case 'FALLIDA_COMPENSADA':
      return { tone: 'danger', icon: 'alert', next: 'No pudimos emitir tus billetes y no se te cobró.' };
    case 'EXPIRADA':
      return { tone: 'danger', icon: 'alert', next: 'La reserva venció sin pago. Busca el vuelo de nuevo.' };
    default:
      return { tone: 'outline', icon: 'clock', next: 'Tu orden está en proceso.' };
  }
}
