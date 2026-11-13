import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { login, registrarCliente } from '../../api/endpoints/auth';
import { vincularOrden } from '../../api/endpoints/orders';
import { peekLastOrder } from '../../lib/storage';
import { getTodayDateString } from '../../lib/dates';
import type { OrdenViewDto } from '../../api/types';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../lib/toast';
import { Input } from '../../components/ui/Input';
import { AuthShell } from './AuthShell';
import { registrationSchema, type RegistrationForm } from './registration-schema';

/** Only same-site paths are followed after signing up, so a crafted link cannot send people elsewhere. */
const safeNext = (value: string | null): string => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/');

/** Stable callback ref: moves the focus to the success message when it appears. */
const focusOnMount = (el: HTMLElement | null) => el?.focus();

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [created, setCreated] = useState<{ nombres: string; signedIn: boolean; linked: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      correo: params.get('correo') ?? '',
      nombres: params.get('nombres') ?? '',
      apellidos: params.get('apellidos') ?? '',
      aceptaTerminos: false,
      consentimientoMarketing: false,
    },
  });

  const onSubmit = async (form: RegistrationForm) => {
    setSubmitError(null);
    try {
      await registrarCliente({
        correo: form.correo,
        contrasena: form.contrasena,
        nombres: form.nombres,
        apellidos: form.apellidos,
        fechaNacimiento: form.fechaNacimiento,
        ...(form.telefono ? { telefono: form.telefono } : {}),
        aceptaTerminos: true,
        consentimientoMarketing: Boolean(form.consentimientoMarketing),
      });
    } catch (error) {
      setSubmitError(error);
      return;
    }

    // The trip just bought as a guest (if any) is read before signing in, because a new session wipes it.
    const pendingOrder = peekLastOrder<OrdenViewDto>();

    // The account exists; signing in right away is a convenience, so a failure here is not an error.
    let signedIn = false;
    try {
      await login({ correo: form.correo, contrasena: form.contrasena });
      signedIn = true;
    } catch (error) {
      if (!(error instanceof ProblemDetailsError)) throw error;
    }

    // Keep that trip: add it to the new account so it shows up in "Mis viajes".
    let linked = false;
    const surname = pendingOrder?.pasajeros?.[0]?.apellidos;
    if (signedIn && pendingOrder && surname) {
      try {
        await vincularOrden({ numero: pendingOrder.numeroOrden, apellido: surname });
        linked = true;
      } catch {
        // Not blocking: the trip can be added later from "Mis viajes".
      }
    }
    setCreated({ nombres: form.nombres, signedIn, linked });
    toast.success('Cuenta creada', signedIn ? 'Ya iniciaste sesión.' : 'Inicia sesión para continuar.');
  };

  if (created) {
    return (
      <AuthShell title="Tu cuenta está lista">
        <div className="text-center focus:outline-none" role="status" tabIndex={-1} ref={focusOnMount}>
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
          <p className="mt-4 text-body text-ink">
            Hola, <strong className="font-semibold">{created.nombres}</strong>. Creamos tu cuenta{created.signedIn ? ' y ya iniciaste sesión' : ''}.
          </p>
          {created.linked && (
            <p className="mt-2 text-body font-medium text-success">Agregamos tu viaje reciente a tu cuenta.</p>
          )}
          <p className="mt-2 text-small text-muted">
            Te enviamos un mensaje para verificar tu correo. No necesitas verificarlo para comprar.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {created.signedIn ? (
              <>
                <Button type="button" variant="primary" size="lg" className="w-full" onClick={() => navigate(next)}>
                  {created.linked ? 'Ver mis viajes' : next === '/' ? 'Buscar vuelos' : 'Continuar'}
                </Button>
                <Link to="/mi-cuenta" className="inline-flex min-h-[44px] items-center justify-center text-small font-medium text-gold-text underline underline-offset-2 hover:text-ink">
                  Ver mi cuenta
                </Link>
              </>
            ) : (
              <Button type="button" variant="primary" size="lg" className="w-full" onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}>
                Iniciar sesión
              </Button>
            )}
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Guarda tus viajes y compra más rápido. Crear una cuenta es gratis." wide>
      {submitError != null && <ProblemAlert error={submitError} title="No pudimos crear tu cuenta" className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nombres" autoComplete="given-name" leftIcon={<User className="h-4 w-4" aria-hidden="true" />} error={errors.nombres?.message} {...register('nombres')} />
          <Input label="Apellidos" autoComplete="family-name" leftIcon={<User className="h-4 w-4" aria-hidden="true" />} error={errors.apellidos?.message} {...register('apellidos')} />
        </div>

        <Input label="Correo electrónico" type="email" autoComplete="email" placeholder="nombre@ejemplo.com" leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />} error={errors.correo?.message} {...register('correo')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Fecha de nacimiento"
            type="date"
            autoComplete="bday"
            max={getTodayDateString()}
            helperText="La pedimos para confirmar que eres mayor de 18 años, requisito para crear una cuenta."
            error={errors.fechaNacimiento?.message}
            {...register('fechaNacimiento')}
          />
          <Input
            label="Teléfono (opcional)"
            type="tel"
            autoComplete="tel"
            placeholder="+593999999999"
            leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
            helperText="Incluye el código de país, por ejemplo +593 para Ecuador."
            error={errors.telefono?.message}
            {...register('telefono')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
              helperText="Mínimo 10 caracteres, con una letra y un número."
              error={errors.contrasena?.message}
              {...register('contrasena')}
            />
          </div>
          <Input
            label="Repite la contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
            error={errors.confirmacion?.message}
            {...register('confirmacion')}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-small font-medium text-muted hover:text-ink"
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </button>

        <div className="space-y-3 rounded-xl border border-line bg-paper p-4">
          <label className="flex cursor-pointer items-start gap-3 text-small text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-line-strong accent-ink" aria-invalid={Boolean(errors.aceptaTerminos)} aria-describedby={errors.aceptaTerminos ? 'acepta-terminos-error' : undefined} {...register('aceptaTerminos')} />
            <span>
              Acepto los{' '}
              <Link to="/terminos" target="_blank" className="font-medium text-gold-text underline underline-offset-2">
                Términos de uso
              </Link>{' '}
              y la{' '}
              <Link to="/privacidad" target="_blank" className="font-medium text-gold-text underline underline-offset-2">
                Política de privacidad
              </Link>
              . *
            </span>
          </label>
          {errors.aceptaTerminos && (
            <p id="acepta-terminos-error" className="text-small font-medium text-danger" role="alert">
              {errors.aceptaTerminos.message}
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3 text-small text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-line-strong accent-ink" {...register('consentimientoMarketing')} />
            <span>Quiero recibir ofertas y novedades por correo (opcional; lo puedes cambiar cuando quieras).</span>
          </label>
        </div>

        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full">
          Crear cuenta
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-small text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-gold-text underline underline-offset-2 hover:text-ink">
          Iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
};
