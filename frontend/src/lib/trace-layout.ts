import type { TrazaNodo } from '../api/endpoints/trazabilidad';

/** Geometry of the node graph: pure functions so they can be tested without a DOM. */

export const NODE_W = 132;
export const NODE_H = 46;
export const GRAPH_W = 900;
const COLUMN_X: Record<string, number> = { cliente: 130, servicio: 450, externo: 770 };
const ROW_GAP = 90;
const TOP = 50;

export interface Point {
  x: number;
  y: number;
}

export interface PlacedNode extends TrazaNodo, Point {}

export interface Layout {
  nodes: PlacedNode[];
  width: number;
  height: number;
}

/** `cliente` left, `servicio` centre, `externo` right; any other type goes in the centre. Order inside a column is the API's. */
export function layoutNodes(nodos: TrazaNodo[]): Layout {
  const rows: Record<string, number> = {};
  const nodes = nodos.map((n) => {
    const column = n.tipo in COLUMN_X ? n.tipo : 'servicio';
    const row = rows[column] ?? 0;
    rows[column] = row + 1;
    return { ...n, x: COLUMN_X[column], y: TOP + row * ROW_GAP };
  });
  const maxRows = Math.max(1, ...Object.values(rows));
  return { nodes, width: GRAPH_W, height: TOP * 2 + (maxRows - 1) * ROW_GAP + NODE_H / 2 };
}

/** The point where the segment from the centre of a node towards `towards` leaves its box. */
export function clipToBox(center: Point, towards: Point): Point {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const t = Math.min(dx !== 0 ? NODE_W / 2 / Math.abs(dx) : Infinity, dy !== 0 ? NODE_H / 2 / Math.abs(dy) : Infinity);
  return { x: center.x + dx * t, y: center.y + dy * t };
}

export interface EdgeGeometry {
  path: string;
  label: Point;
}

/**
 * Path of the `index`-th edge among `count` between the same pair of nodes. `forward` tells whether the edge goes in the
 * canonical direction of the pair, so that opposite arrows bend to opposite sides and never overlap.
 */
export function edgeGeometry(from: Point, to: Point, index: number, count: number, forward: boolean): EdgeGeometry {
  const offset = (index - (count - 1) / 2) * 44;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const sign = forward ? 1 : -1;
  // Perpendicular to the canonical direction (from -> to when forward).
  const px = (-dy / len) * sign;
  const py = (dx / len) * sign;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const control = { x: mid.x + px * offset * 2, y: mid.y + py * offset * 2 };
  const start = clipToBox(from, control);
  const end = clipToBox(to, control);
  const label = { x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y };
  return { path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, label };
}

/** A loop on the right side of the node (`ordenes -> ordenes`); several loops grow outwards. */
export function loopGeometry(at: Point, index: number): EdgeGeometry {
  const size = 46 + index * 26;
  const x = at.x + NODE_W / 2;
  return {
    path: `M ${x} ${at.y - 10} C ${x + size} ${at.y - size} ${x + size} ${at.y + size} ${x} ${at.y + 10}`,
    label: { x: x + size * 0.75, y: at.y },
  };
}
