import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Baby, Mail, Phone, UserRound } from 'lucide-react';
import { registrarPasajeros } from '../../api/endpoints/offers';
import { usePerfil } from '../../api/endpoints/auth';
import { useLocalidades } from '../../api/endpoints/catalog';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { selectionsFromRegistered, toAsientosPayload, type SeatSelections } from '../../lib/seats';
import { passengerTitle, type Titular } from '../../lib/checkout';
import { getTodayDateString, addDaysToDate } from '../../lib/dates';
import { ageRangeMessage, birthDateRange, flightDay, isInternationalTrip, type PassengerType } from '../../lib/passenger-rules';
import { useSession } from '../../lib/session';
import { buildPassengerFormSchema, type PassengerFormValues } from './passenger-schema';
import { SeatSelector } from './SeatSelector';
import { StepActions } from './StepActions';
import { CHECKOUT_FORM_ID } from './step-actions-context';
import type { OfertaViewDto, RegistrarPasajerosDto, PasajeroDto } from '../../api/types';

const COUNTRIES = [
  { value: 'EC', label: 'Ecuador' },
  { value: 'CO', label: 'Colombia' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'ES', label: 'España' },
  { value: 'MX', label: 'México' },
  { value: 'PE', label: 'Perú' },
  { value: 'CL', label: 'Chile' },
  { value: 'AR', label: 'Argentina' },
  { value: 'PA', label: 'Panamá' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CA', label: 'Canadá' },
  { value: 'FR', label: 'Francia' },
  { value: 'DE', label: 'Alemania' },
  { value: 'GB', label: 'Reino Unido' },
];

const GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'X', label: 'Otro' },
];

const DOCUMENT_TYPES = [
  { value: 'NATIONAL_ID', label: 'Cédula de identidad' },
  { value: 'PASSPORT', label: 'Pasaporte' },
];

interface PassengerFormProps {
  oferta: OfertaViewDto;
  /** Receives the saved offer and the first traveller, so the next step can reuse their data. */
  onSuccess: (updatedOferta: OfertaViewDto, titular?: Titular) => void;
}

const emptyPassenger = (id: string, tipo: PasajeroDto['tipo'], extra: Partial<PasajeroDto> = {}): PasajeroDto => ({
  id,
  tipo,
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  genero: 'M',
  nacionalidad: 'EC',
  documento: { tipo: 'NATIONAL_ID', numero: '', vencimiento: '' },
  ...extra,
});

export const PassengerForm: React.FC<PassengerFormProps> = ({ oferta, onSuccess }) => {
  const session = useSession();
  const perfil = usePerfil(session?.kind === 'customer', session?.ownerId);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Optional seat picks, kept here so they travel with the passengers (and survive coming back to this step).
  const [seats, setSeats] = useState<SeatSelections>(() => selectionsFromRegistered(oferta.pasajerosRegistrados));

  // The passengers of the offer, adults first (the API ids are only for the request, people see "Pasajero 1 · Adulto").
  const adtCount = oferta.pasajeros?.adultos || 1;
  const ythCount = oferta.pasajeros?.jovenes || 0;
  const chdCount = oferta.pasajeros?.ninos || 0;
  const infCount = oferta.pasajeros?.infantes || 0;

  const defaultPassengers: PasajeroDto[] = [];
  for (let i = 1; i <= adtCount; i++) defaultPassengers.push(emptyPassenger(`ADT-${i}`, 'ADULT'));
  for (let i = 1; i <= ythCount; i++) defaultPassengers.push(emptyPassenger(`YTH-${i}`, 'YOUTH'));
  for (let i = 1; i <= chdCount; i++) defaultPassengers.push(emptyPassenger(`CHD-${i}`, 'CHILD'));
  for (let i = 1; i <= infCount; i++) defaultPassengers.push(emptyPassenger(`INF-${i}`, 'INFANT', { asociadoA: `ADT-${Math.min(i, adtCount)}` }));

  // Rules that depend on the trip: ages are measured on the UTC day of the first flight, the document on the last.
  const localidades = useLocalidades();
  const today = getTodayDateString();
  const firstFlightDay = flightDay(oferta.trayectos[0].salida);
  const lastFlightDay = flightDay(oferta.trayectos[oferta.trayectos.length - 1].salida);
  const countryOf = useMemo(() => new Map((localidades.data ?? []).map((l) => [l.iata, l.pais] as const)), [localidades.data]);
  const international = isInternationalTrip(oferta.trayectos, countryOf);
  const formSchema = useMemo(
    () => buildPassengerFormSchema({ firstFlightDay, lastFlightDay, international, today, ids: defaultPassengers.map((p) => p.id) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firstFlightDay, lastFlightDay, international, today, defaultPassengers.length],
  );

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<PassengerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pasajeros: defaultPassengers,
      contacto: { correo: '', telefono: '' },
    },
  });

  // A signed-in customer is almost always the first traveller: offer their name and e-mail, never overwrite what was typed.
  useEffect(() => {
    const data = perfil.data;
    if (!data) return;
    if (!getValues('pasajeros.0.nombres')) setValue('pasajeros.0.nombres', data.nombres);
    if (!getValues('pasajeros.0.apellidos')) setValue('pasajeros.0.apellidos', data.apellidos);
    if (!getValues('pasajeros.0.numeroSocio') && data.numeroSocio) setValue('pasajeros.0.numeroSocio', data.numeroSocio);
    if (!getValues('contacto.correo')) setValue('contacto.correo', data.correo);
  }, [perfil.data, getValues, setValue]);

  const { fields } = useFieldArray({ control, name: 'pasajeros' });

  // `fields[].id` is the key react-hook-form generates, not the passenger id the API needs: take ids from the defaults.
  const adultsList = defaultPassengers.filter((p) => p.tipo === 'ADULT');

  const watched = useWatch({ control, name: 'pasajeros' });
  const seatPassengers = defaultPassengers
    .map((p, idx) => ({ id: p.id, tipo: p.tipo, idx }))
    .filter((p) => p.tipo !== 'INFANT')
    .map((p, order) => {
      const typed = `${watched?.[p.idx]?.nombres ?? ''} ${watched?.[p.idx]?.apellidos ?? ''}`.trim();
      return { id: p.id, label: typed || `Pasajero ${order + 1}` };
    });

  const onSubmit = async (values: PassengerFormValues) => {
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
      const first = values.pasajeros[0];
      onSuccess(updated, {
        nombres: first.nombres,
        apellidos: first.apellidos,
        documento: { tipo: first.documento.tipo, numero: first.documento.numero },
      });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form id={CHECKOUT_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {submitError != null && <ProblemAlert error={submitError} />}

      {fields.map((field, idx) => {
        const paxErrors = errors.pasajeros?.[idx];
        const isInfant = field.tipo === 'INFANT';
        const type = field.tipo as PassengerType;
        const range = birthDateRange(type, firstFlightDay, today);
        const prefix = `pax-${idx}`;

        return (
          <Card key={field.id} className="space-y-5 p-5 sm:p-6" role="group" aria-labelledby={`${prefix}-title`}>
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold-text" aria-hidden="true">
                  {isInfant ? <Baby className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                </span>
                <h2 id={`${prefix}-title`} className="text-lead font-semibold text-ink">
                  {passengerTitle(idx + 1, field.tipo)}
                </h2>
              </div>
              {isInfant && <Badge variant="secondary">Viaja en brazos</Badge>}
            </div>

            {isInfant && (
              <Select
                label="Adulto que lo lleva en brazos"
                id={`${prefix}-asociadoA`}
                error={paxErrors?.asociadoA?.message}
                {...register(`pasajeros.${idx}.asociadoA` as const)}
              >
                {adultsList.map((adult, aIdx) => (
                  <option key={adult.id} value={adult.id}>
                    {passengerTitle(aIdx + 1, 'ADULT')}
                  </option>
                ))}
              </Select>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Nombres"
                id={`${prefix}-nombres`}
                placeholder="Juan Carlos"
                autoComplete={idx === 0 ? 'given-name' : 'off'}
                helperText="Tal como aparecen en el documento."
                error={paxErrors?.nombres?.message}
                {...register(`pasajeros.${idx}.nombres` as const)}
              />
              <Input
                label="Apellidos"
                id={`${prefix}-apellidos`}
                placeholder="Pérez Gómez"
                autoComplete={idx === 0 ? 'family-name' : 'off'}
                helperText="Tal como aparecen en el documento."
                error={paxErrors?.apellidos?.message}
                {...register(`pasajeros.${idx}.apellidos` as const)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Fecha de nacimiento"
                id={`${prefix}-nacimiento`}
                type="date"
                min={range.min}
                max={range.max}
                helperText={`${ageRangeMessage(type)}.`}
                error={paxErrors?.fechaNacimiento?.message}
                {...register(`pasajeros.${idx}.fechaNacimiento` as const)}
              />
              <Select label="Género" id={`${prefix}-genero`} options={GENDERS} {...register(`pasajeros.${idx}.genero` as const)} />
              <Select label="Nacionalidad" id={`${prefix}-nacionalidad`} options={COUNTRIES} error={paxErrors?.nacionalidad?.message} {...register(`pasajeros.${idx}.nacionalidad` as const)} />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <Select label="Tipo de documento" id={`${prefix}-doctipo`} options={DOCUMENT_TYPES} {...register(`pasajeros.${idx}.documento.tipo` as const)} />
              <Input
                label="Número de documento"
                id={`${prefix}-docnumero`}
                placeholder="1712345678"
                error={paxErrors?.documento?.numero?.message}
                {...register(`pasajeros.${idx}.documento.numero` as const)}
              />
              <Input
                label={international ? 'Vence el' : 'Vence el (opcional)'}
                id={`${prefix}-docvence`}
                type="date"
                min={addDaysToDate(lastFlightDay, 1)}
                error={paxErrors?.documento?.vencimiento?.message}
                {...register(`pasajeros.${idx}.documento.vencimiento` as const)}
              />
            </div>
          </Card>
        );
      })}

      {/* Optional seat selection, per leg */}
      <SeatSelector oferta={oferta} passengers={seatPassengers} value={seats} onChange={setSeats} />

      <Card className="space-y-5 p-5 sm:p-6" role="group" aria-labelledby="contacto-title">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold-text" aria-hidden="true">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h2 id="contacto-title" className="text-lead font-semibold text-ink">
              Datos de contacto
            </h2>
            <p className="text-small text-muted">Aquí enviaremos tus boletos y el itinerario.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Correo electrónico"
            id="contacto-correo"
            type="email"
            placeholder="nombre@correo.com"
            autoComplete="email"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.contacto?.correo?.message}
            {...register('contacto.correo')}
          />
          <Input
            label="Teléfono"
            id="contacto-telefono"
            type="tel"
            placeholder="+593 99 123 4567"
            autoComplete="tel"
            leftIcon={<Phone className="h-4 w-4" />}
            helperText="Con el código de tu país, por ejemplo +593."
            error={errors.contacto?.telefono?.message}
            {...register('contacto.telefono')}
          />
        </div>
      </Card>

      <StepActions submitLabel="Continuar a facturación" loading={isSubmitting} loadingLabel="Guardando datos…" />
    </form>
  );
};
