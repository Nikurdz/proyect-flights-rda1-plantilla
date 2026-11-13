import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus } from 'lucide-react';
import { useToast } from '../../lib/toast';
import { vincularOrden } from '../../api/endpoints/orders';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface AddTripFormProps {
  /** Opens the form right away (used by the empty state). */
  startOpen?: boolean;
}

/** Adds a trip bought before the account existed (as a guest) using its code and a passenger's surname. */
export const AddTripForm: React.FC<AddTripFormProps> = ({ startOpen = false }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(startOpen);
  const [code, setCode] = useState('');
  const [surname, setSurname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; surname?: string }>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value || !surname.trim()) {
      setFieldErrors({ code: value ? undefined : 'Escribe el código de reserva o el número de orden.', surname: surname.trim() ? undefined : 'Escribe el apellido de un pasajero.' });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const order = await vincularOrden({ ...(value.startsWith('ORD-') ? { numero: value } : { pnr: value }), apellido: surname.trim() });
      setAdded(order.numeroOrden);
      toast.success('Viaje agregado', `La orden ${order.numeroOrden} ya está en tu cuenta.`);
      setCode('');
      setSurname('');
      await queryClient.invalidateQueries({ queryKey: ['mis-ordenes'] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[44px] items-center gap-1.5 text-small font-medium text-gold-text underline underline-offset-2 hover:text-ink">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        ¿Compraste sin cuenta? Agrega tu viaje
      </button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-line bg-surface p-5 text-left">
      <div>
        <h2 className="text-lead font-semibold text-ink">Agregar un viaje a mi cuenta</h2>
        <p className="mt-0.5 text-small text-muted">Si compraste antes de crear tu cuenta, escribe el código de reserva (o el número de orden) y el apellido de un pasajero.</p>
      </div>

      {error != null && <ProblemAlert error={error} title="No pudimos agregar el viaje" />}
      {added && (
        <p className="flex items-center gap-2 text-body font-medium text-success" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Listo: agregamos la orden {added} a tu cuenta.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Código de reserva u orden" placeholder="ABC123 o ORD-…" value={code} error={fieldErrors.code} onChange={(e) => setCode(e.target.value)} />
        <Input label="Apellido de un pasajero" placeholder="Pérez" value={surname} error={fieldErrors.surname} onChange={(e) => setSurname(e.target.value)} />
      </div>
      <Button type="submit" variant="primary" size="md" isLoading={busy}>
        Agregar a mi cuenta
      </Button>
    </form>
  );
};
