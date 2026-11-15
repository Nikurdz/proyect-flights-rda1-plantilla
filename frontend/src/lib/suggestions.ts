export interface Suggestion {
  /** Lo que se escribe en el campo al elegirla. */
  value: string;
  /** Texto visible; por defecto, el valor. */
  label?: string;
  /** Texto secundario (ciudad, rol...). También se usa al filtrar. */
  hint?: string;
}

/** Minúsculas y sin acentos, para comparar lo escrito con las opciones. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Filtra en vivo: primero las que empiezan por lo escrito, luego las que lo contienen. Sin texto, las primeras. */
export function filterSuggestions(suggestions: readonly Suggestion[], query: string, max = 8): Suggestion[] {
  const q = normalizeText(query);
  if (!q) return suggestions.slice(0, max);
  const starts: Suggestion[] = [];
  const contains: Suggestion[] = [];
  for (const s of suggestions) {
    const value = normalizeText(s.value);
    const haystack = `${value} ${normalizeText(s.label ?? '')} ${normalizeText(s.hint ?? '')}`;
    if (value.startsWith(q)) starts.push(s);
    else if (haystack.includes(q)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, max);
}

/** Sugerencias sin repetir a partir de valores ya cargados en la pantalla (vacíos descartados). */
export function uniqueSuggestions(values: readonly (string | null | undefined)[], limit = 100): Suggestion[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].slice(0, limit).map((value) => ({ value }));
}

