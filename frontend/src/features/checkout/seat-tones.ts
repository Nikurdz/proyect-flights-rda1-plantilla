const HATCH = 'bg-[repeating-linear-gradient(135deg,transparent_0,transparent_3px,rgb(var(--line-strong))_3px,rgb(var(--line-strong))_5px)]';

/** One tone per seat state, shared by the map and its legend so they can never disagree. */
export const SEAT_TONES = {
  free: 'border-line-strong bg-surface text-ink hover:border-gold-text hover:bg-gold-soft',
  extra: 'border-gold-text/60 bg-gold-soft text-gold-text hover:border-gold-text',
  taken: 'cursor-not-allowed border-line bg-ink/10 text-muted',
  held: `cursor-not-allowed border-dashed border-muted text-muted ${HATCH}`,
  mine: 'border-gold bg-gold text-on-gold ring-2 ring-gold-text/40',
  other: 'border-ink bg-ink text-on-ink',
} as const;
