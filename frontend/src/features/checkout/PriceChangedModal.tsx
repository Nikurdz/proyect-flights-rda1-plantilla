import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { aceptarPrecio } from '../../api/endpoints/offers';
import type { MontoDto, OfertaViewDto } from '../../api/types';

interface PriceChangedModalProps {
  isOpen: boolean;
  ofertaId: string;
  precioAnterior: MontoDto;
  precioNuevo: MontoDto;
  onAccepted: (updatedOferta: OfertaViewDto) => void;
  /** "Buscar otro vuelo": the page takes the traveller back to the results of their search. */
  onCancel: () => void;
}

export const PriceChangedModal: React.FC<PriceChangedModalProps> = ({ isOpen, ofertaId, precioAnterior, precioNuevo, onAccepted, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await aceptarPrecio(ofertaId, { totalAceptado: precioNuevo.monto });
      onAccepted(updated);
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} dismissible={false} title="El precio cambió">
      <div className="space-y-5">
        <p className="flex items-start gap-3 rounded-lg bg-warning-soft p-3 text-small text-warning">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>La aerolínea actualizó la tarifa mientras comprabas. Tus asientos siguen apartados si aceptas el nuevo total.</span>
        </p>

        {error != null && <ProblemAlert error={error} />}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <dt className="text-small text-muted">Precio anterior</dt>
            <dd className="mt-1 text-muted line-through">
              <MoneyText amount={precioAnterior.monto} currency={precioAnterior.moneda} size="lg" className="num" />
            </dd>
          </div>
          <div className="rounded-lg border-2 border-ink p-4">
            <dt className="text-small font-medium text-ink">Precio nuevo</dt>
            <dd className="mt-1 text-ink">
              <MoneyText amount={precioNuevo.monto} currency={precioNuevo.moneda} size="xl" className="num" />
            </dd>
          </div>
        </dl>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Buscar otro vuelo
          </Button>
          <Button type="button" variant="primary" onClick={handleAccept} isLoading={isSubmitting}>
            {isSubmitting ? 'Confirmando…' : 'Pagar el nuevo precio'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
