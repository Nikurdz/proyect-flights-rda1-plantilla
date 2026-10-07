import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import { useMercado } from '../../api/endpoints/markets';
import { registrarFacturacion } from '../../api/endpoints/offers';
import { FieldError, FieldLabel, fieldA11y } from '../../components/ui/FormField';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import type { OfertaViewDto, FacturacionDto } from '../../api/types';

const billingSchema = z.object({
  tipoIdentificacion: z.string().min(1, 'Selecciona el tipo de identificación'),
  numeroIdentificacion: z.string().min(3, 'Ingresa el número de identificación fiscal').trim(),
  razonSocial: z.string().min(3, 'Ingresa el nombre o razón social completa').trim(),
  direccion: z.string().min(5, 'Ingresa la dirección fiscal').trim(),
  pais: z.string().min(2, 'Selecciona el país fiscal'),
});

type FormValues = z.infer<typeof billingSchema>;

interface BillingFormProps {
  oferta: OfertaViewDto;
  onSuccess: (updatedOferta: OfertaViewDto) => void;
  onBack: () => void;
}

export const BillingForm: React.FC<BillingFormProps> = ({ oferta, onSuccess, onBack }) => {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: mercadoData } = useMercado(oferta.mercado);
  const fiscalOptions = mercadoData?.identificacionesFiscales || [
    { tipo: 'CEDULA', etiqueta: 'Cédula de Identidad', patron: '' },
    { tipo: 'RUC', etiqueta: 'RUC / Registro Tributario', patron: '' },
    { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '' },
  ];

  const defaultTipo = fiscalOptions[0]?.tipo || 'CEDULA';
  const defaultPais = 'EC';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      tipoIdentificacion: defaultTipo,
      numeroIdentificacion: '',
      razonSocial: '',
      direccion: '',
      pais: defaultPais,
    },
  });

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {submitError != null && <ProblemAlert error={submitError} className="mb-4" />}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-xl bg-airline-navy/5 text-airline-navy flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Datos para Comprobante Fiscal</h3>
            <p className="text-xs text-slate-500">
              Información tributaria para la emisión de la factura electrónica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="bill-tipo">
              Tipo de Identificación Fiscal *
            </FieldLabel>
            <select
              {...fieldA11y('bill-tipo', errors.tipoIdentificacion?.message)}
              {...register('tipoIdentificacion')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
            >
              {fiscalOptions.map((opt) => (
                <option key={opt.tipo} value={opt.tipo}>
                  {opt.etiqueta || opt.tipo}
                </option>
              ))}
            </select>
            <FieldError id="bill-tipo" message={errors.tipoIdentificacion?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="bill-numero">
              Número de Identificación (RUC / Cédula / NIT) *
            </FieldLabel>
            <input
              type="text"
              placeholder="Ej. 1790012345001"
              {...fieldA11y('bill-numero', errors.numeroIdentificacion?.message)}
              {...register('numeroIdentificacion')}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                errors.numeroIdentificacion
                  ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                  : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
              }`}
            />
            <FieldError id="bill-numero" message={errors.numeroIdentificacion?.message} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="bill-razon">
            Nombre / Razón Social *
          </FieldLabel>
          <input
            type="text"
            placeholder="Ej. Juan Pérez o Corporación Ejemplo S.A."
            {...fieldA11y('bill-razon', errors.razonSocial?.message)}
            {...register('razonSocial')}
            className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
              errors.razonSocial
                ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
            }`}
          />
          <FieldError id="bill-razon" message={errors.razonSocial?.message} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="bill-direccion">
              Dirección Fiscal Completa *
            </FieldLabel>
            <input
              type="text"
              placeholder="Ej. Av. Amazonas 123 y Naciones Unidas"
              {...fieldA11y('bill-direccion', errors.direccion?.message)}
              {...register('direccion')}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                errors.direccion
                  ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                  : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
              }`}
            />
            <FieldError id="bill-direccion" message={errors.direccion?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="bill-pais">País *</FieldLabel>
            <select
              {...fieldA11y('bill-pais', errors.pais?.message)}
              {...register('pais')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
            >
              <option value="EC">Ecuador (EC)</option>
              <option value="CO">Colombia (CO)</option>
              <option value="US">Estados Unidos (US)</option>
              <option value="ES">España (ES)</option>
              <option value="MX">México (MX)</option>
              <option value="PE">Perú (PE)</option>
              <option value="CL">Chile (CL)</option>
              <option value="AR">Argentina (AR)</option>
            </select>
            <FieldError id="bill-pais" message={errors.pais?.message} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Pasajeros</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-airline-navy text-white font-bold text-sm hover:bg-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span>Guardando facturación...</span>
          ) : (
            <>
              <span>Continuar a Condiciones</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
