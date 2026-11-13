// Checks WCAG contrast of the design tokens in src/styles/index.css (light = :root, dark = .dark).
// Usage: node scripts/contrast.mjs   (exit 1 if a pair is below its minimum)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');

function block(selector) {
  const start = css.indexOf(`\n${selector} {`);
  const end = css.indexOf('\n}', start);
  const body = css.slice(start, end);
  const vars = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(\d+) (\d+) (\d+);/g)) vars[m[1]] = [+m[2], +m[3], +m[4]];
  return vars;
}

const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum, usage]
const PAIRS = [
  ['ink', 'paper', 4.5, 'texto principal sobre papel'],
  ['ink', 'surface', 4.5, 'texto principal sobre superficie'],
  ['muted', 'paper', 4.5, 'texto secundario sobre papel'],
  ['muted', 'surface', 4.5, 'texto secundario sobre superficie'],
  ['gold-text', 'paper', 4.5, 'dorado texto sobre papel'],
  ['gold-text', 'surface', 4.5, 'dorado texto sobre superficie'],
  ['gold-text', 'gold-soft', 4.5, 'dorado texto sobre dorado suave'],
  ['ink', 'gold-soft', 4.5, 'texto sobre dorado suave'],
  ['on-ink', 'ink', 4.5, 'boton primario (tinta)'],
  ['on-gold', 'gold', 4.5, 'boton de compra (dorado)'],
  ['on-danger', 'danger', 4.5, 'boton de peligro'],
  ['success', 'success-soft', 4.5, 'texto exito sobre su fondo suave'],
  ['danger', 'danger-soft', 4.5, 'texto error sobre su fondo suave'],
  ['warning', 'warning-soft', 4.5, 'texto aviso sobre su fondo suave'],
  ['success', 'surface', 4.5, 'texto exito sobre superficie'],
  ['danger', 'surface', 4.5, 'texto error sobre superficie'],
  ['danger', 'paper', 4.5, 'texto error sobre papel'],
  ['warning', 'surface', 4.5, 'texto aviso sobre superficie'],
  ['gold-text', 'paper', 3, 'foco / icono (no texto) sobre papel'],
  ['gold-text', 'surface', 3, 'foco sobre superficie'],
  ['line-strong', 'surface', 3, 'borde de control sobre superficie'],
  ['line-strong', 'paper', 3, 'borde de control sobre papel'],
  ['gold', 'chrome', 4.5, 'dorado sobre superficie de marca (chrome)'],
];

let failed = 0;
for (const [mode, selector] of [['claro', ':root'], ['oscuro', '.dark']]) {
  const t = block(selector);
  console.log(`\n## ${mode}`);
  for (const [fg, bg, min, usage] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log(`?? falta ${fg} o ${bg}`); failed++; continue; }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${fg} / ${bg}  - ${usage}`);
  }
}
process.exit(failed ? 1 : 0);
