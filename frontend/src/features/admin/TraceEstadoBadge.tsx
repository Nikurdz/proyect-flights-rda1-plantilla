import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { AUDIT_BADGE_CLASS } from '../../lib/auditoria';
import { estadoTraza } from '../../lib/trazabilidad';

/** Status as colour AND icon AND text (never colour alone). */
export const TraceEstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const { label, tone } = estadoTraza(estado);
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : CircleDashed;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${AUDIT_BADGE_CLASS[tone]}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
};
