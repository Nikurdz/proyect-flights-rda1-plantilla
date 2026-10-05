/** Lower-cases, strips accents and collapses whitespace: the form used to match search prefixes. */
export function normalizarTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * RF-CHK-003: ticket names carry no diacritics or special characters (Ñ -> N, José -> JOSE).
 * Returns the upper-case form the airline systems accept.
 */
export function normalizarNombrePasajero(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z '-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
