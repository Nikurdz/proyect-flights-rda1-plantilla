/** The link a passenger's QR code opens: the public check page for that ticket's signed code. */
export function ticketVerificationUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/verificar/${encodeURIComponent(code)}`;
}

/** Spanish label for a ticket state as the public check reports it. */
export function ticketStateLabel(state?: string): string {
  switch (state) {
    case 'ISSUED':
      return 'Emitido';
    case 'VOIDED':
      return 'Anulado';
    case 'REFUNDED':
      return 'Reembolsado';
    case 'FAILED':
      return 'No emitido';
    default:
      return 'En proceso';
  }
}
