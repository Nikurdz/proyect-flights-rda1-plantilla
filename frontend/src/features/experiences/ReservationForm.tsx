import React, { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { crearSesionInvitado, usePerfil } from '../../api/endpoints/auth';
import { reservarExperiencia } from '../../api/endpoints/experiencias';
import { useMercado } from '../../api/endpoints/markets';
import { ProblemDetailsError } from '../../api/problem-details';
import type { ExperienciaView, ReservarExperienciaInput, ReservaExternaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCardForm } from '../../hooks/useCardForm';
import { consumesKey, reservaSchema, todayIso, totalEstimado, validateTaxId, type ReservaForm, type ReservaValues } from '../../lib/experiencias';
import { getSession, useSession } from '../../lib/session';
import { generateUUID } from '../../lib/uuid';
import { CardFieldset } from './CardFieldset';

const COUNTRIES = [
  { value: 'EC', label: 'Ecuador (EC)' },
  { value: 'CO', label: 'Colombia (CO)' },
  { value: 'US', label: 'Estados Unidos (US)' },
  { value: 'ES', label: 'España (ES)' },
  { value: 'MX', label: 'México (MX)' },
  { value: 'PE', label: 'Perú (PE)' },
  { value: 'CL', label: 'Chile (CL)' },
  { value: 'AR', label: 'Argentina (AR)' },
];

const FALLBACK_TAX_TYPES = [
  { tipo: 'CEDULA', etiqueta: 'Cédula de Identidad', patron: '' },
  { tipo: 'RUC', etiqueta: 'RUC / Registro Tributario', patron: '' },
  { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '' },
];

interface Props {
  experiencia: ExperienciaView;
  onReserved: (reserva: ReservaExternaView) => void;
  /** Called when the server says the price changed, so the page can reload the experience. */
  onPriceChanged?: () => void;
}

export const ReservationForm: React.FC<Props> = ({ experiencia, onReserved, onPriceChanged }) => {
  const session = useSession();
  const card = useCardForm();
  const { data: mercado } = useMercado('ec');
  const perfil = usePerfil(session?.kind === 'customer', session?.ownerId);
  const taxTypes = mercado?.identificacionesFiscales?.length ? mercado.identificacionesFiscales : FALLBACK_TAX_TYPES;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getValues,
    formState: { errors },
  } = useForm<ReservaForm, unknown, ReservaValues>({
    resolver: zodResolver(reservaSchema),
    defaultValues: { fecha: '', hora: '', cantidad: 1, nombre: '', correo: '', tipoIdentificacion: taxTypes[0].tipo, numeroIdentificacion: '', razonSocial: '', direccion: '', pais: 'EC' },
  });

  // A customer's name and e-mail are known: offer them, never overwrite what was already typed.
  useEffect(() => {
    if (!perfil.data) return;
    if (!getValues('nombre')) setValue('nombre', `${perfil.data.nombres} ${perfil.data.apellidos}`.trim());
    if (!getValues('correo')) setValue('correo', perfil.data.correo);
  }, [perfil.data, getValues, setValue]);

  // The first tax type of the market arrives after the first render.
  const tipoActual = useWatch({ control, name: 'tipoIdentificacion' });
  useEffect(() => {
    if (!taxTypes.some((t) => t.tipo === tipoActual)) setValue('tipoIdentificacion', taxTypes[0].tipo);
  }, [taxTypes, tipoActual, setValue]);

  const cantidad = Number(useWatch({ control, name: 'cantidad' })) || 0;
  const total = cantidad >= 1 && cantidad <= 10 ? totalEstimado(experiencia.precio, cantidad) : null;

  const [isPaying, setIsPaying] = useState(false);
  const [error, setSubmitError] = useState<unknown>(null);
  // One Idempotency-Key per payment attempt: retrying the SAME request after a network failure reuses it
  // (so it can never charge twice); a changed request, or an outcome already stored under it, starts a new one.
  const keyRef = useRef<string>(generateUUID());
  const signatureRef = useRef<string>('');

  const onValid = async (values: ReservaValues) => {
    card.touchAll();
    const choice = card.choice();
    if (!choice) return;
    const patron = taxTypes.find((t) => t.tipo === values.tipoIdentificacion)?.patron;
    const taxProblem = validateTaxId(values.numeroIdentificacion, patron);
    if (taxProblem) {
      setError('numeroIdentificacion', { message: taxProblem });
      return;
    }
    if (isPaying) return;

    const body: ReservarExperienciaInput = {
      fecha: values.fecha,
      ...(values.hora ? { hora: values.hora } : {}),
      cantidad: values.cantidad,
      nombre: values.nombre,
      correo: values.correo,
      facturacion: {
        tipoIdentificacion: values.tipoIdentificacion,
        numeroIdentificacion: values.numeroIdentificacion,
        razonSocial: values.razonSocial,
        direccion: values.direccion,
        pais: values.pais,
      },
      medio: { tipo: 'TARJETA', token: choice.token, marca: choice.marca },
    };

    const signature = JSON.stringify(body);
    if (signature !== signatureRef.current) {
      keyRef.current = generateUUID();
      signatureRef.current = signature;
    }

    setIsPaying(true);
    setSubmitError(null);
    try {
      // Buying needs a session: a customer's, or a guest's when there is none (or it expired).
      if (!getSession()) await crearSesionInvitado();
      const reserva = await reservarExperiencia(experiencia.id, body, keyRef.current);
      card.wipe();
      onReserved(reserva);
    } catch (err) {
      setSubmitError(err);
      if (consumesKey(err)) {
        keyRef.current = generateUUID();
        signatureRef.current = '';
      }
      if (err instanceof ProblemDetailsError && err.code === 'PRICE_CHANGED') onPriceChanged?.();
      card.setCvv('');
    } finally {
      setIsPaying(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    card.touchAll();
    void handleSubmit(onValid)(event);
  };

  const submitMessage = (() => {
    if (!(error instanceof ProblemDetailsError)) return undefined;
    if (error.code === 'EXTERNAL_RESERVATION_FAILED_COMPENSATED') {
      return 'El proveedor no pudo confirmar la experiencia y no se te cobró nada. Puedes intentarlo de nuevo o elegir otra fecha.';
    }
    if (error.code === 'PRICE_CHANGED') return 'El precio de la experiencia cambió. Revisa el nuevo total y vuelve a reservar: no se te cobró.';
    if (error.code === 'NOT_FOUND') return 'Esta experiencia ya no está disponible.';
    return undefined;
  })();

  return (
    <form onSubmit={submit} noValidate autoComplete="off" aria-label="Reservar experiencia" className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      {error != null && <ProblemAlert error={error} message={submitMessage} title="No se pudo completar la reserva" />}

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold text-slate-900">1. Fecha y personas</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Fecha" type="date" min={todayIso()} error={errors.fecha?.message} {...register('fecha')} />
          <Input label="Hora (opcional)" type="time" error={errors.hora?.message} {...register('hora')} />
          <Input label="Personas" type="number" inputMode="numeric" min={1} max={10} error={errors.cantidad?.message} {...register('cantidad')} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold text-slate-900">2. Tus datos</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombre completo" autoComplete="name" error={errors.nombre?.message} {...register('nombre')} />
          <Input label="Correo electrónico" type="email" autoComplete="email" helperText="Aquí enviaremos la confirmación." error={errors.correo?.message} {...register('correo')} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold text-slate-900">3. Datos de facturación</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Tipo de identificación" options={taxTypes.map((t) => ({ value: t.tipo, label: t.etiqueta || t.tipo }))} error={errors.tipoIdentificacion?.message} {...register('tipoIdentificacion')} />
          <Input label="Número de identificación" placeholder="1790012345001" error={errors.numeroIdentificacion?.message} {...register('numeroIdentificacion')} />
        </div>
        <Input label="Nombre o razón social" autoComplete="organization" error={errors.razonSocial?.message} {...register('razonSocial')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <Input label="Dirección fiscal" autoComplete="street-address" error={errors.direccion?.message} {...register('direccion')} />
          <Select label="País" options={COUNTRIES} error={errors.pais?.message} {...register('pais')} />
        </div>
      </fieldset>

      <CardFieldset card={card} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <div aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total estimado</p>
          {total ? <MoneyText amount={total.monto} currency={total.moneda} size="2xl" /> : <span className="text-sm text-slate-500">Indica cuántas personas.</span>}
          <p className="text-[11px] text-slate-500">
            {experiencia.precio.moneda} {experiencia.precio.monto} por persona. El detalle con IVA está en la factura.
          </p>
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={isPaying}>
          <Lock className="mr-2 h-4 w-4 text-brand-gold" aria-hidden="true" />
          {isPaying ? 'Procesando…' : 'Pagar y reservar'}
        </Button>
      </div>
    </form>
  );
};
