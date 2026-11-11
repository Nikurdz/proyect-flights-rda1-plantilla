/** Hides most of an e-mail address: first letter of the name and the domain are kept ("d***@gmail.com"). */
export function enmascararCorreo(correo: string): string {
  const arroba = correo.lastIndexOf('@');
  if (arroba <= 0) return '***';
  return `${correo[0]}***${correo.slice(arroba)}`;
}

/** Hides a phone number except its last three digits ("+593 9** *** 999" becomes "***999"). */
export function enmascararTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length <= 3) return '***';
  return `***${digitos.slice(-3)}`;
}
