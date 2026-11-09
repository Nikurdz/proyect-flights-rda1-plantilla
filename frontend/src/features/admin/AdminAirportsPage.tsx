import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlaneTakeoff } from 'lucide-react';
import { useAeropuertos, useCrearAeropuerto } from '../../api/endpoints/admin';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { newAirportSchema, type NewAirportData, type NewAirportForm } from './admin-schemas';
import { ConfirmDialog } from './ConfirmDialog';

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Mounted only while open so the form and the mutation start clean. Two steps: form, then confirmation. */
const CreateAirportDialog: React.FC<{ onClose: () => void; onCreated: (iata: string) => void }> = ({ onClose, onCreated }) => {
  const crear = useCrearAeropuerto();
  const [pending, setPending] = useState<NewAirportData | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewAirportForm, unknown, NewAirportData>({
    resolver: zodResolver(newAirportSchema),
    defaultValues: { iata: '', ciudad: '', nombre: '', pais: 'EC', paisNombre: 'Ecuador', zonaHoraria: 'America/Guayaquil' },
  });

  const confirm = () => {
    if (!pending) return;
    crear.mutate(
      { ...pending, confirmar: true },
      {
        onSuccess: (a) => {
          onCreated(a.iata);
          onClose();
        },
      },
    );
  };

  const closeConfirm = () => {
    setPending(null);
    crear.reset();
  };

  return (
    <>
      <Dialog isOpen={pending === null} onClose={onClose} title="Nuevo aeropuerto" description="Agrega un código al catálogo para poder crear vuelos desde y hacia él." maxWidth="lg">
        <form onSubmit={handleSubmit((data) => setPending(data))} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <Input
              label="Código IATA"
              autoComplete="off"
              maxLength={3}
              className="uppercase"
              helperText="3 letras."
              error={errors.iata?.message}
              {...register('iata')}
            />
            <Input label="Ciudad" autoComplete="off" error={errors.ciudad?.message} {...register('ciudad')} />
          </div>
          <Input label="Nombre del aeropuerto" autoComplete="off" error={errors.nombre?.message} {...register('nombre')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <Input label="País (código)" autoComplete="off" maxLength={2} helperText="2 letras (ISO)." error={errors.pais?.message} {...register('pais')} />
            <Input label="Nombre del país" autoComplete="off" error={errors.paisNombre?.message} {...register('paisNombre')} />
          </div>
          <Input
            label="Zona horaria"
            autoComplete="off"
            list="zonas-sugeridas"
            helperText="Zona IANA. Ecuador continental: America/Guayaquil; Galápagos: Pacific/Galapagos."
            error={errors.zonaHoraria?.message}
            {...register('zonaHoraria')}
          />
          <datalist id="zonas-sugeridas">
            <option value="America/Guayaquil" />
            <option value="Pacific/Galapagos" />
          </datalist>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Revisar y continuar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={pending !== null}
        title="Confirmar nuevo aeropuerto"
        confirmLabel="Crear aeropuerto"
        isLoading={crear.isPending}
        error={crear.error}
        errorMessage={adminErrorMessage(crear.error, 'crear-aeropuerto')}
        onConfirm={confirm}
        onClose={closeConfirm}
      >
        {pending && (
          <>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-slate-500">Código</dt>
              <dd className="font-bold">{pending.iata}</dd>
              <dt className="text-slate-500">Ciudad</dt>
              <dd>{pending.ciudad}</dd>
              <dt className="text-slate-500">Aeropuerto</dt>
              <dd>{pending.nombre}</dd>
              <dt className="text-slate-500">País</dt>
              <dd>
                {pending.paisNombre} ({pending.pais})
              </dd>
              <dt className="text-slate-500">Zona horaria</dt>
              <dd>{pending.zonaHoraria}</dd>
            </dl>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              Una vez creado, este código no se podrá borrar ni editar desde la web, porque los vuelos lo referencian. Revisa que sea correcto.
            </p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
};

export const AdminAirportsPage: React.FC = () => {
  const session = useSession();
  const [q, setQ] = useState('');
  const [pais, setPais] = useState('');
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const debouncedQ = useDebounced(q.trim(), 350);
  const paisFiltro = pais.trim().toUpperCase();
  const paisValido = /^[A-Z]{2}$/.test(paisFiltro) ? paisFiltro : '';

  const filterKey = `${debouncedQ}|${paisValido}`;
  const [page, setPage] = useState({ key: filterKey, n: 1 });
  const pagina = page.key === filterKey ? page.n : 1;
  const setPagina = (next: (current: number) => number) => setPage({ key: filterKey, n: next(pagina) });

  const { data, isLoading, isFetching, error, refetch } = useAeropuertos({ q: debouncedQ, pais: paisValido, pagina, limite: PAGE_SIZE }, session?.ownerId);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section aria-label="Aeropuertos">
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_12rem_auto]">
        <Input label="Buscar" type="search" placeholder="Código, ciudad o aeropuerto" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input
          label="País"
          placeholder="EC"
          maxLength={2}
          autoComplete="off"
          helperText="Código de 2 letras."
          value={pais}
          onChange={(e) => setPais(e.target.value)}
        />
        <div className="flex items-start pt-6">
          <Button type="button" variant="accent" className="w-full" onClick={() => setCreating(true)}>
            <PlaneTakeoff className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo aeropuerto
          </Button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{notice}</p>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>
            Cerrar aviso
          </button>
        </div>
      )}

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <div role="region" tabIndex={0} aria-label="Tabla de aeropuertos, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm" aria-busy={isFetching}>
          <caption className="sr-only">Aeropuertos del catálogo</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Código</th>
              <th scope="col" className="px-4 py-3">Ciudad</th>
              <th scope="col" className="px-4 py-3">Aeropuerto</th>
              <th scope="col" className="px-4 py-3">País</th>
              <th scope="col" className="px-4 py-3">Zona horaria</th>
              <th scope="col" className="px-4 py-3 text-right">Vuelos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4">
                  <div role="status" aria-busy="true" aria-label="Cargando">
                    <Skeleton className="h-24 w-full" />
                  </div>
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.iata}>
                <td className="px-4 py-3 font-black text-brand-black">{a.iata}</td>
                <td className="px-4 py-3">{a.ciudad}</td>
                <td className="px-4 py-3 text-slate-700">{a.nombre}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {a.paisNombre} ({a.pais})
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.zonaHoraria}</td>
                <td className="px-4 py-3 text-right tabular-nums">{a.vuelos}</td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay aeropuertos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginación de aeropuertos" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p>
          {total} aeropuerto(s) · página {data?.pagina ?? pagina} de {pages}
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pagina >= pages} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      </nav>

      {creating && <CreateAirportDialog onClose={() => setCreating(false)} onCreated={(iata) => setNotice(`Aeropuerto ${iata} creado. Ya puedes crear vuelos desde y hacia él.`)} />}
    </section>
  );
};
