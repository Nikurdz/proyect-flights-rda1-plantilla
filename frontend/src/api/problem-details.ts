export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetailsPayload {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  invalidParams?: InvalidParam[];
}

/** A field problem ready to show to a person: Spanish label and Spanish reason. */
export interface FieldProblem {
  name: string;
  label: string;
  reason: string;
}

export class ProblemDetailsError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly invalidParams: FieldProblem[];
  public readonly correlationId?: string;

  constructor(payload: ProblemDetailsPayload, correlationId?: string) {
    const status = payload.status || 500;
    super(getFriendlyErrorMessage(payload.code, status));
    this.name = 'ProblemDetailsError';
    this.status = status;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.invalidParams = (payload.invalidParams || []).map(toFieldProblem);
    this.correlationId = correlationId;
  }
}

const FIELD_LABELS: [RegExp, string][] = [
  [/correo|email/i, 'Correo electrónico'],
  [/contrasena|password/i, 'Contraseña'],
  [/nombres|firstname/i, 'Nombres'],
  [/apellidos?|lastname/i, 'Apellidos'],
  [/fechaNacimiento|birthdate/i, 'Fecha de nacimiento'],
  [/telefono|phone/i, 'Teléfono'],
  [/documento.*numero|documentnumber/i, 'Número de documento'],
  [/documento.*vencimiento|documentexpiry/i, 'Vencimiento del documento'],
  [/documento.*tipo|documenttype/i, 'Tipo de documento'],
  [/nacionalidad|nationality/i, 'Nacionalidad'],
  [/genero|gender/i, 'Género'],
  [/numeroIdentificacion/i, 'Número de identificación'],
  [/tipoIdentificacion/i, 'Tipo de identificación'],
  [/razonSocial/i, 'Nombre o razón social'],
  [/direccion/i, 'Dirección'],
  [/pais/i, 'País'],
  [/aceptaTerminos/i, 'Aceptación de términos'],
  [/versionTerminos|versionCondiciones/i, 'Aceptación de condiciones'],
  [/cuotas/i, 'Cuotas'],
  [/marca/i, 'Marca de la tarjeta'],
  [/token|medio/i, 'Medio de pago'],
  [/origin|origen/i, 'Origen'],
  [/destination|destino/i, 'Destino'],
  [/outbound|inbound|departuredate|fecha/i, 'Fecha'],
  [/adt|chd|inf|pasajeros|passengers/i, 'Pasajeros'],
  [/apellido/i, 'Apellido'],
  [/numero/i, 'Número de orden'],
  [/pnr/i, 'Código de reserva'],
];

const REASON_PATTERNS: [RegExp, string][] = [
  [/email/i, 'Ingresa un correo válido.'],
  [/at least|minimum|min\b|too short|10 char/i, 'Es demasiado corto.'],
  [/at most|maximum|too long/i, 'Es demasiado largo.'],
  [/letter and one number|one letter|one number/i, 'Debe incluir al menos una letra y un número.'],
  [/past/i, 'Debe ser una fecha pasada.'],
  [/future|not be in the past/i, 'No puede ser una fecha pasada.'],
  [/required|must not be empty|should not be empty/i, 'Este dato es obligatorio.'],
  [/E\.164|phone/i, 'Usa el formato internacional, por ejemplo +593999999999.'],
  [/date|YYYY-MM-DD/i, 'Ingresa una fecha válida.'],
  [/already|duplicate/i, 'Este dato ya está registrado.'],
];

export function fieldLabel(name: string): string {
  const hit = FIELD_LABELS.find(([pattern]) => pattern.test(name));
  return hit ? hit[1] : 'Dato';
}

function toFieldProblem(param: InvalidParam): FieldProblem {
  const hit = REASON_PATTERNS.find(([pattern]) => pattern.test(param.reason));
  return { name: param.name, label: fieldLabel(param.name), reason: hit ? hit[1] : 'Revisa este dato.' };
}

/**
 * Maps API problem codes to clear Spanish messages. The backend's own `detail` text is English and
 * written for developers, so it is never shown to a person.
 */
export function getFriendlyErrorMessage(code: string | undefined, status: number = 500): string {
  switch (code) {
    case 'VALIDATION_FAILED':
      return 'Algunos datos no son válidos. Revisa los campos señalados.';
    case 'UNAUTHORIZED':
      return 'Tu sesión terminó. Inicia sesión nuevamente para continuar.';
    case 'FORBIDDEN':
      return 'No tienes permiso para ver esta información.';
    case 'NOT_FOUND':
    case 'ORDER_NOT_FOUND':
      return 'No encontramos lo que buscas. Verifica los datos e intenta de nuevo.';
    case 'EMAIL_ALREADY_REGISTERED':
      return 'Este correo ya tiene una cuenta. Inicia sesión.';
    case 'INVALID_CREDENTIALS':
      return 'El correo o la contraseña no son correctos.';
    case 'ACCOUNT_LOCKED':
      return 'Por seguridad, tu cuenta quedó bloqueada unos minutos tras varios intentos fallidos. Intenta más tarde.';
    case 'TOO_MANY_ATTEMPTS':
    case 'RATE_LIMIT_EXCEEDED':
      return 'Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.';
    case 'MARKET_NOT_AVAILABLE':
      return 'La venta no está disponible en este momento.';
    case 'OFFER_EXPIRED':
    case 'QUOTE_EXPIRED':
      return 'El tiempo de tu reserva terminó. Haz una nueva búsqueda para continuar.';
    case 'OFFER_INCOMPLETE':
      return 'Faltan datos obligatorios antes de pagar.';
    case 'OFFER_NOT_PAYABLE':
      return 'Esta reserva ya no se puede pagar.';
    case 'PRICE_CHANGED':
      return 'El precio cambió. Revisa y acepta el nuevo total para continuar.';
    case 'CONDITIONS_VERSION_MISMATCH':
      return 'Las condiciones se actualizaron. Léelas y acéptalas de nuevo.';
    case 'SEAT_TAKEN':
    case 'OFFER_NO_LONGER_AVAILABLE':
      return 'Ya no quedan cupos en este vuelo. Elige otro horario.';
    case 'PAYMENT_DECLINED':
      return 'El banco rechazó el pago. Tu reserva sigue vigente: prueba con otra tarjeta.';
    case 'PAYMENT_REJECTED_BY_FRAUD':
      return 'No pudimos aprobar el pago por seguridad. Prueba con otra tarjeta; si ya lo intentaste varias veces, empieza con una búsqueda nueva.';
    case 'PAYMENT_METHOD_NOT_ALLOWED':
      return 'Este medio de pago no está disponible para tu compra.';
    case 'ISSUANCE_FAILED_COMPENSATED':
      return 'No pudimos emitir tus boletos y no se te cobró. Intenta nuevamente.';
    case 'INVALID_STATE_TRANSITION':
    case 'BOOKING_NOT_CONFIRMED':
    case 'CONFLICT':
      return 'Esta operación ya no es posible en el estado actual. Actualiza la página e intenta de nuevo.';
    case 'SERVICE_UNAVAILABLE':
      return 'El servicio no responde por ahora. Intenta de nuevo en unos segundos.';
    case 'NOT_IMPLEMENTED':
      return 'Esta función aún no está disponible.';
    default:
      if (status === 401) return 'Tu sesión terminó. Inicia sesión nuevamente para continuar.';
      if (status === 404) return 'No encontramos lo que buscas.';
      if (status === 429) return 'Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.';
      if (status >= 500) return 'Tuvimos un problema de nuestro lado. Intenta de nuevo en unos segundos.';
      return 'No pudimos completar la operación. Revisa los datos e intenta de nuevo.';
  }
}
