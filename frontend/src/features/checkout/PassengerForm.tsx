import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Mail, Phone, ArrowRight, Baby, UserCheck } from 'lucide-react';
import { registrarPasajeros } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { selectionsFromRegistered, toAsientosPayload, type SeatSelections } from '../../lib/seats';
import { SeatSelector } from './SeatSelector';
import type { OfertaViewDto, RegistrarPasajerosDto, PasajeroDto } from '../../api/types';

const COUNTRIES = [
  { code: 'EC', name: 'Ecuador' },
  { code: 'CO', name: 'Colombia' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'ES', name: 'España' },
  { code: 'MX', name: 'México' },
  { code: 'PE', name: 'Perú' },
  { code: 'CL', name: 'Chile' },
  { code: 'AR', name: 'Argentina' },
  { code: 'PA', name: 'Panamá' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CA', name: 'Canadá' },
  { code: 'FR', name: 'Francia' },
  { code: 'DE', name: 'Alemania' },
  { code: 'GB', name: 'Reino Unido' },
];

const passengerSchema = z.object({
  id: z.string(),
  tipo: z.enum(['ADULT', 'YOUTH', 'CHILD', 'INFANT']),
  nombres: z.string().min(2, 'Ingresa al menos 2 letras').trim(),
  apellidos: z.string().min(2, 'Ingresa al menos 2 letras').trim(),
  fechaNacimiento: z.string().min(10, 'Ingresa la fecha de nacimiento.'),
  genero: z.enum(['M', 'F', 'X']),
  nacionalidad: z.string().min(2, 'Selecciona la nacionalidad'),
  documento: z.object({
    tipo: z.enum(['PASSPORT', 'NATIONAL_ID']),
    numero: z.string().min(4, 'Mínimo 4 caracteres').trim(),
    vencimiento: z.string().optional(),
  }),
  numeroSocio: z.string().optional(),
  asociadoA: z.string().optional(),
});

const formSchema = z.object({
  pasajeros: z.array(passengerSchema),
  contacto: z.object({
    correo: z.string().email('Ingresa un correo electrónico válido'),
    telefono: z
      .string()
      .min(8, 'Ingresa un teléfono con código de país, por ejemplo +593999999999.')
      .regex(/^\+[1-9]\d{6,14}$/, 'Usa el formato internacional: "+" y el código de país, por ejemplo +593999999999.'),
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface PassengerFormProps {
  oferta: OfertaViewDto;
  onSuccess: (updatedOferta: OfertaViewDto) => void;
}

export const PassengerForm: React.FC<PassengerFormProps> = ({ oferta, onSuccess }) => {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Optional seat picks, kept here so they travel with the passengers (and survive coming back to this step).
  const [seats, setSeats] = useState<SeatSelections>(() => selectionsFromRegistered(oferta.pasajerosRegistrados));

  // Initialize initial passengers list based on offer passenger counts
  const adtCount = oferta.pasajeros?.adultos || 1;
  const chdCount = oferta.pasajeros?.ninos || 0;
  const infCount = oferta.pasajeros?.infantes || 0;

  const defaultPassengers: PasajeroDto[] = [];

  for (let i = 1; i <= adtCount; i++) {
    defaultPassengers.push({
      id: `ADT-${i}`,
      tipo: 'ADULT',
      nombres: '',
      apellidos: '',
      fechaNacimiento: '',
      genero: 'M',
      nacionalidad: 'EC',
      documento: {
        tipo: 'NATIONAL_ID',
        numero: '',
        vencimiento: '',
      },
    });
  }

  for (let i = 1; i <= chdCount; i++) {
    defaultPassengers.push({
      id: `CHD-${i}`,
      tipo: 'CHILD',
      nombres: '',
      apellidos: '',
      fechaNacimiento: '',
      genero: 'M',
      nacionalidad: 'EC',
      documento: {
        tipo: 'NATIONAL_ID',
        numero: '',
        vencimiento: '',
      },
    });
  }

  for (let i = 1; i <= infCount; i++) {
    defaultPassengers.push({
      id: `INF-${i}`,
      tipo: 'INFANT',
      asociadoA: `ADT-${Math.min(i, adtCount)}`,
      nombres: '',
      apellidos: '',
      fechaNacimiento: '',
      genero: 'M',
      nacionalidad: 'EC',
      documento: {
        tipo: 'NATIONAL_ID',
        numero: '',
        vencimiento: '',
      },
    });
  }

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pasajeros: defaultPassengers,
      contacto: {
        correo: '',
        telefono: '',
      },
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'pasajeros',
  });

  // `fields[].id` is the key react-hook-form generates, not the passenger id the API needs: take ids from the defaults.
  const adultsList = defaultPassengers.filter((p) => p.tipo === 'ADULT');

  const watched = watch('pasajeros');
  const seatPassengers = defaultPassengers
    .map((p, idx) => ({ id: p.id, tipo: p.tipo, idx }))
    .filter((p) => p.tipo !== 'INFANT')
    .map((p, order) => {
      const typed = `${watched?.[p.idx]?.nombres ?? ''} ${watched?.[p.idx]?.apellidos ?? ''}`.trim();
      return { id: p.id, label: typed || `Pasajero ${order + 1}` };
    });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: RegistrarPasajerosDto = {
        pasajeros: values.pasajeros.map((p, idx) => ({
          ...p,
          id: defaultPassengers[idx].id,
          asientos: p.tipo === 'INFANT' ? undefined : toAsientosPayload(seats, defaultPassengers[idx].id),
          documento: {
            ...p.documento,
            vencimiento: p.documento.vencimiento || undefined,
          },
          asociadoA: p.tipo === 'INFANT' ? p.asociadoA : undefined,
          numeroSocio: p.numeroSocio ? p.numeroSocio.trim() : undefined,
        })),
        contacto: values.contacto,
      };

      const updated = await registrarPasajeros(oferta.ofertaId, payload);
      onSuccess(updated);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {submitError != null && <ProblemAlert error={submitError} className="mb-4" />}

      {/* Passenger Cards */}
      <div className="space-y-6">
        {fields.map((field, idx) => {
          const paxErrors = errors.pasajeros?.[idx];
          const isInfant = field.tipo === 'INFANT';
          const isChild = field.tipo === 'CHILD';

          const labelTitle = isInfant
            ? `Bebé / Infante (${idx + 1})`
            : isChild
            ? `Niño / Menor (${idx + 1})`
            : `Adulto Responsable (${idx + 1})`;

          return (
            <div
              key={field.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-airline-navy/5 text-airline-navy flex items-center justify-center font-bold text-xs">
                    {isInfant ? <Baby className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{labelTitle}</h3>
                    <span className="text-[11px] text-slate-400 font-mono">ID: {field.id}</span>
                  </div>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 uppercase font-mono">
                  {field.tipo}
                </span>
              </div>

              {/* Infant Associated Adult */}
              {isInfant && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-700" />
                    <span>Asignar adulto acompañante (viaja en brazos)</span>
                  </div>
                  <select
                    {...register(`pasajeros.${idx}.asociadoA` as const)}
                    className="w-full text-xs rounded-lg border-amber-300 bg-white p-2 text-slate-800 focus:ring-amber-500 focus:border-amber-500"
                  >
                    {adultsList.map((adult, aIdx) => (
                      <option key={adult.id} value={adult.id}>
                        Adulto {aIdx + 1} ({adult.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Names and Surnames */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombres (tal como en el documento) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Carlos"
                    {...register(`pasajeros.${idx}.nombres` as const)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                      paxErrors?.nombres
                        ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                        : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                    }`}
                  />
                  {paxErrors?.nombres && (
                    <p className="mt-1 text-[11px] text-red-600">{paxErrors.nombres.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apellidos (tal como en el documento) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Pérez Gómez"
                    {...register(`pasajeros.${idx}.apellidos` as const)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                      paxErrors?.apellidos
                        ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                        : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                    }`}
                  />
                  {paxErrors?.apellidos && (
                    <p className="mt-1 text-[11px] text-red-600">{paxErrors.apellidos.message}</p>
                  )}
                </div>
              </div>

              {/* Birthdate, Gender, Nationality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    {...register(`pasajeros.${idx}.fechaNacimiento` as const)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                      paxErrors?.fechaNacimiento
                        ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                        : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                    }`}
                  />
                  {paxErrors?.fechaNacimiento && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {paxErrors.fechaNacimiento.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Género *</label>
                  <select
                    {...register(`pasajeros.${idx}.genero` as const)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
                  >
                    <option value="M">Masculino (M)</option>
                    <option value="F">Femenino (F)</option>
                    <option value="X">No binario / Otro (X)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nacionalidad *
                  </label>
                  <select
                    {...register(`pasajeros.${idx}.nacionalidad` as const)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Identification Document */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo Documento *
                  </label>
                  <select
                    {...register(`pasajeros.${idx}.documento.tipo` as const)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
                  >
                    <option value="NATIONAL_ID">Documento Nacional / Cédula</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Documento *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 1712345678"
                    {...register(`pasajeros.${idx}.documento.numero` as const)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                      paxErrors?.documento?.numero
                        ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                        : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                    }`}
                  />
                  {paxErrors?.documento?.numero && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {paxErrors.documento.numero.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha Vencimiento (opcional)
                  </label>
                  <input
                    type="date"
                    {...register(`pasajeros.${idx}.documento.vencimiento` as const)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-airline-blue focus:outline-none focus:ring-2 focus:ring-airline-blue/20"
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Optional seat selection, per leg */}
      <SeatSelector oferta={oferta} passengers={seatPassengers} value={seats} onChange={setSeats} />

      {/* Contact Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Mail className="w-5 h-5 text-airline-navy" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Datos de Contacto del Comprador</h3>
            <p className="text-xs text-slate-500">
              Aquí enviaremos los billetes electrónicos e itinerario de vuelo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                placeholder="ejemplo@correo.com"
                {...register('contacto.correo')}
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.contacto?.correo
                    ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                    : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                }`}
              />
            </div>
            {errors.contacto?.correo && (
              <p className="mt-1 text-[11px] text-red-600">{errors.contacto.correo.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teléfono (Formato internacional E.164) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="tel"
                placeholder="+593999999999 o +573001234567"
                {...register('contacto.telefono')}
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.contacto?.telefono
                    ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                    : 'border-slate-300 focus:border-airline-blue focus:ring-airline-blue/20'
                }`}
              />
            </div>
            {errors.contacto?.telefono && (
              <p className="mt-1 text-[11px] text-red-600">{errors.contacto.telefono.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-airline-navy text-white font-bold text-sm hover:bg-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span>Guardando datos...</span>
          ) : (
            <>
              <span>Continuar a Facturación</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
