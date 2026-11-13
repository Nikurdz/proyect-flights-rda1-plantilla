import React from 'react';
import { Luggage, Briefcase, RefreshCw, Undo2, Armchair, Wallet } from 'lucide-react';
import type { FamiliaTarifariaDto } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface FareFamilyCardProps {
  familia: FamiliaTarifariaDto;
  onSelect: (familia: FamiliaTarifariaDto) => void;
  /** The family with the lowest total of the list (computed from the data by the modal): «Más conveniente». */
  isBestValue?: boolean;
}

export const FareFamilyCard: React.FC<FareFamilyCardProps> = ({ familia, onSelect, isBestValue = false }) => {
  const cond = familia.condiciones;
  const name = familia.nombre || familia.codigo;

  const rows = [
    {
      icon: Briefcase,
      title: 'Equipaje de mano',
      included: Boolean(cond?.equipajeMano?.incluido),
      yes: `Incluido (${cond?.equipajeMano?.kg} kg en cabina)`,
      no: 'Solo un artículo personal',
    },
    {
      icon: Luggage,
      title: 'Equipaje de bodega',
      included: Boolean(cond?.equipajeBodega?.piezas && cond.equipajeBodega.piezas > 0),
      yes: `${cond?.equipajeBodega?.piezas} ${cond?.equipajeBodega?.piezas === 1 ? 'pieza' : 'piezas'} de 23 kg incluida`,
      no: 'No incluido',
    },
    {
      icon: RefreshCw,
      title: 'Cambios de fecha',
      included: Boolean(cond?.cambio?.permitido),
      yes: 'Permitidos, con cargo o diferencia de tarifa',
      no: 'No permitidos',
    },
    {
      icon: Undo2,
      title: 'Reembolso',
      included: Boolean(cond?.devolucion?.permitida),
      yes: 'Reembolsable',
      no: 'No reembolsable',
    },
    {
      icon: Armchair,
      title: 'Elegir asiento',
      included: Boolean(cond?.seleccionAsiento?.incluida),
      yes: 'Asiento estándar incluido',
      no: 'No incluido',
    },
  ];

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-xl border bg-surface ${
        isBestValue ? 'border-gold-text ring-2 ring-gold-text/25' : 'border-line'
      }`}
    >
      <div className="border-b border-line p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-lead font-semibold text-ink">{name}</h3>
          {isBestValue && (
            <Badge variant="secondary" icon={<Wallet />}>
              Más conveniente
            </Badge>
          )}
        </div>
        <p className="text-small text-muted">{familia.asientosDisponibles} asientos disponibles</p>

        <div className="mt-4 border-t border-line pt-3">
          <span className="block text-small text-muted">Total del grupo</span>
          <div className="num text-ink">
            <MoneyText amount={familia.totalGrupo?.monto} currency={familia.totalGrupo?.moneda} size="2xl" />
          </div>
          <span className="text-small text-muted">Impuestos incluidos</span>
        </div>
      </div>

      <ul className="flex-1 space-y-3.5 p-5 text-small">
        {rows.map(({ icon: Icon, title, included, yes, no }) => (
          <li key={title} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <span className="block font-medium text-ink">{title}</span>
              <span className={included ? 'text-success' : 'text-muted'}>{included ? yes : no}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="p-5 pt-0">
        <Button variant={isBestValue ? 'accent' : 'outline'} onClick={() => onSelect(familia)} className="w-full" aria-label={`Elegir tarifa ${name}`}>
          Elegir {name}
        </Button>
      </div>
    </div>
  );
};
