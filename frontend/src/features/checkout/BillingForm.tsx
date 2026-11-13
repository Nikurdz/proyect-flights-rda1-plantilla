import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, UserRoundCheck } from 'lucide-react';
import { useMercado } from '../../api/endpoints/markets';
import { registrarFacturacion } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { countryName, type Titular } from '../../lib/checkout';
import { StepActions } from './StepActions';
import { CHECKOUT_FORM_ID } from './step-actions-context';
import type { OfertaViewDto, FacturacionDto } from '../../api/types';

const billingSchema = z.object({
  tipoIdentificacion: z.string().min(1, 'Elige el tipo de documento.'),
  numeroIdentificacion: z.string().trim().min(3, 'Escribe tu cédula, RUC o pasaporte.'),
  razonSocial: z.string().trim().min(3, 'Escribe el nombre o la razón social completa.'),
  direccion: z.string().trim().min(5, 'Escribe la dirección de la factura.'),
  pais: z.string().min(2, 'Elige el país.'),
});

type FormValues = z.infer<typeof billingSchema>;

interface BillingFormProps {
  oferta: OfertaViewDto;
  /** The first traveller, when known: one tap copies their name and document into the invoice. */
  titular?: Titular;
  onSuccess: (updatedOferta: OfertaViewDto) => void;
  onBack: () => void;
}

const FALLBACK_TYPES = [
  { tipo: 'CEDULA', etiqueta: 'Cédula de identidad', patron: '' },
  { tipo: 'RUC', etiqueta: 'RUC', patron: '' },
  { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '' },
];

export const BillingForm: React.FC<BillingFormProps> = ({ oferta, titular, onSuccess, onBack }) => {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: mercadoData } = useMercado(oferta.mercado);
  const fiscalOptions = mercadoData?.identificacionesFiscales?.length ? mercadoData.identificacionesFiscales : FALLBACK_TYPES;
  // The platform sells in one market: the invoice is issued in its country (Ecuador).
  const countryCode = (mercadoData?.pais || 'EC').toUpperCase();

  // Without the data typed in the previous step (e.g. after a reload) the saved name is still known.
  const first = oferta.pasajerosRegistrados?.[0];
  const source: Titular | undefined = titular ?? (first ? { nombres: first.nombres, apellidos: first.apellidos } : undefined);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      tipoIdentificacion: fiscalOptions[0]?.tipo || 'CEDULA',
      numeroIdentificacion: '',
      razonSocial: '',
      direccion: '',
      pais: countryCode,
    },
  });

  const fillFromFirstPassenger = () => {
    if (!source) return;
    setValue('razonSocial', `${source.nombres} ${source.apellidos}`.trim(), { shouldValidate: true });
    if (source.documento?.numero) {
      const wanted = source.documento.tipo === 'PASSPORT' ? 'PASAPORTE' : 'CEDULA';
      if (fiscalOptions.some((opt) => opt.tipo === wanted)) setValue('tipoIdentificacion', wanted, { shouldValidate: true });
      setValue('numeroIdentificacion', source.documento.numero, { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: FacturacionDto = {
        tipoIdentificacion: values.tipoIdentificacion,
        numeroIdentificacion: values.numeroIdentificacion,
        razonSocial: values.razonSocial,
        direccion: values.direccion,
        pais: values.pais,
      };

      const updated = await registrarFacturacion(oferta.ofertaId, payload);
      onSuccess(updated);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form id={CHECKOUT_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {submitError != null && <ProblemAlert error={submitError} />}

      <Card className="space-y-5 p-5 sm:p-6" role="group" aria-labelledby="billing-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold-text" aria-hidden="true">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="billing-title" className="text-lead font-semibold text-ink">
                A nombre de quién va la factura
              </h2>
              <p className="text-small text-muted">Te enviaremos la factura electrónica con estos datos.</p>
            </div>
          </div>
          {source && (
            <Button type="button" variant="outline" size="sm" onClick={fillFromFirstPassenger}>
              <UserRoundCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              Usar datos del pasajero 1
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Tipo de documento"
            id="bill-tipo"
            options={fiscalOptions.map((opt) => ({ value: opt.tipo, label: opt.etiqueta || opt.tipo }))}
            error={errors.tipoIdentificacion?.message}
            {...register('tipoIdentificacion')}
          />
          <Input label="Cédula, RUC o pasaporte" id="bill-numero" placeholder="1790012345001" error={errors.numeroIdentificacion?.message} {...register('numeroIdentificacion')} />
        </div>

        <Input
          label="Nombre o razón social"
          id="bill-razon"
          placeholder="Juan Pérez o Corporación Ejemplo S.A."
          autoComplete="name"
          error={errors.razonSocial?.message}
          {...register('razonSocial')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label="Dirección"
              id="bill-direccion"
              placeholder="Av. Amazonas N23-45 y Wilson"
              autoComplete="street-address"
              error={errors.direccion?.message}
              {...register('direccion')}
            />
          </div>
          <Select label="País" id="bill-pais" options={[{ value: countryCode, label: countryName(countryCode) }]} error={errors.pais?.message} {...register('pais')} />
        </div>
      </Card>

      <StepActions submitLabel="Continuar a condiciones" loading={isSubmitting} loadingLabel="Guardando…" backLabel="Volver a pasajeros" onBack={onBack} />
    </form>
  );
};
