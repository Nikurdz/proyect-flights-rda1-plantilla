import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, ShieldCheck, UserPlus } from 'lucide-react';
import {
  esAdministrador,
  useAdminUsuarios,
  useCambiarRoles,
  useCrearUsuario,
  type AdminUsuario,
  type RolUsuario,
} from '../../api/endpoints/admin';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { newUserSchema, type NewUserForm } from './admin-schemas';
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

const CreateUserDialog: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: (correo: string) => void }> = ({ isOpen, onClose, onCreated }) => {
  const crear = useCrearUsuario();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewUserForm>({ resolver: zodResolver(newUserSchema), defaultValues: { esAdmin: false } });

  useEffect(() => {
    if (isOpen) {
      reset({ esAdmin: false });
      crear.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onSubmit = (form: NewUserForm) => {
    const roles: RolUsuario[] = form.esAdmin ? ['CUSTOMER', 'ADMIN'] : ['CUSTOMER'];
    crear.mutate(
      {
        correo: form.correo,
        contrasena: form.contrasena,
        nombres: form.nombres,
        apellidos: form.apellidos,
        fechaNacimiento: form.fechaNacimiento,
        ...(form.telefono ? { telefono: form.telefono } : {}),
        roles,
      },
      {
        onSuccess: (usuario) => {
          onCreated(usuario.correo);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Crear usuario" description="La cuenta nace con el correo verificado." maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {crear.error != null && <ProblemAlert error={crear.error} message={adminErrorMessage(crear.error, 'crear-usuario')} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombres" autoComplete="off" error={errors.nombres?.message} {...register('nombres')} />
          <Input label="Apellidos" autoComplete="off" error={errors.apellidos?.message} {...register('apellidos')} />
        </div>
        <Input label="Correo electrónico" type="email" autoComplete="off" error={errors.correo?.message} {...register('correo')} />
        <Input
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          helperText="Al menos 10 caracteres, con una letra y un número."
          error={errors.contrasena?.message}
          {...register('contrasena')}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Fecha de nacimiento" type="date" error={errors.fechaNacimiento?.message} {...register('fechaNacimiento')} />
          <Input label="Teléfono (opcional)" type="tel" placeholder="+593999999999" error={errors.telefono?.message} {...register('telefono')} />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register('esAdmin')} />
          <span>
            Darle también el rol <strong>Administrador</strong>
            <span className="block text-xs text-slate-500">Podrá ver órdenes, gestionar vuelos y otros usuarios.</span>
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={crear.isPending}>
            Crear usuario
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export const AdminUsersPage: React.FC = () => {
  const session = useSession();
  const [q, setQ] = useState('');
  const [rol, setRol] = useState<RolUsuario | ''>('');
  const [pagina, setPagina] = useState(1);
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<AdminUsuario | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const debouncedQ = useDebounced(q.trim(), 350);

  useEffect(() => setPagina(1), [debouncedQ, rol]);

  const { data, isLoading, isFetching, error, refetch } = useAdminUsuarios({ q: debouncedQ, rol, pagina, limite: PAGE_SIZE }, session?.ownerId);
  const cambiar = useCambiarRoles();

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const myId = session?.ownerId;

  const closeConfirm = () => {
    setTarget(null);
    cambiar.reset();
  };

  const confirmRole = () => {
    if (!target) return;
    const quitar = esAdministrador(target);
    cambiar.mutate(
      { clienteId: target.clienteId, roles: quitar ? ['CUSTOMER'] : ['CUSTOMER', 'ADMIN'] },
      {
        onSuccess: () => {
          setNotice(
            quitar
              ? `${target.correo} ya no es administrador. El cambio se aplica cuando vuelva a iniciar sesión.`
              : `${target.correo} ahora es administrador. El cambio se aplica cuando vuelva a iniciar sesión.`,
          );
          closeConfirm();
        },
      },
    );
  };

  const removing = target ? esAdministrador(target) : false;

  return (
    <section aria-label="Usuarios">
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900" role="note">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Los cambios de rol se aplican cuando la persona <strong>inicia sesión de nuevo</strong>: su sesión actual conserva los roles que tenía hasta que expire.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_14rem_auto]">
        <Input label="Buscar" type="search" placeholder="Correo, nombres o apellidos" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          label="Rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario | '')}
          options={[
            { value: '', label: 'Todos' },
            { value: 'ADMIN', label: 'Administrador' },
            { value: 'CUSTOMER', label: 'Cliente' },
          ]}
        />
        <div className="flex items-end">
          <Button type="button" variant="accent" className="w-full" onClick={() => setCreating(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Crear usuario
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

      <div role="region" tabIndex={0} aria-label="Tabla de usuarios, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm" aria-busy={isFetching}>
          <caption className="sr-only">Usuarios registrados</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Usuario</th>
              <th scope="col" className="px-4 py-3">Rol</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Creado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-4" role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </td>
              </tr>
            )}
            {users.map((u) => {
              const admin = esAdministrador(u);
              const isSelf = u.clienteId === myId;
              const selfBlocked = admin && isSelf;
              const hintId = `self-${u.clienteId}`;
              return (
                <tr key={u.clienteId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-black">
                      {u.nombres} {u.apellidos}
                      {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(tú)</span>}
                    </p>
                    <p className="text-xs text-slate-600">{u.correo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={admin ? 'primary' : 'secondary'}>{admin ? 'Administrador' : 'Cliente'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {u.bloqueada ? <Badge variant="danger">Bloqueada</Badge> : u.correoVerificado ? 'Correo verificado' : 'Correo sin verificar'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(u.creadoEn)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={admin ? 'outline' : 'secondary'}
                      disabled={selfBlocked}
                      aria-describedby={selfBlocked ? hintId : undefined}
                      onClick={() => setTarget(u)}
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {admin ? 'Quitar administrador' : 'Hacer administrador'}
                    </Button>
                    {selfBlocked && (
                      <p id={hintId} className="mt-1 text-[11px] text-slate-500">
                        No puedes quitarte tu propio rol de administrador.
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && users.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay usuarios con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginación de usuarios" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p>
          {total} usuario(s) · página {data?.pagina ?? pagina} de {pages}
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

      <CreateUserDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={(correo) => setNotice(`Usuario ${correo} creado.`)} />

      <ConfirmDialog
        isOpen={Boolean(target)}
        title={removing ? 'Quitar administrador' : 'Hacer administrador'}
        confirmLabel={removing ? 'Quitar administrador' : 'Hacer administrador'}
        destructive={removing}
        isLoading={cambiar.isPending}
        error={cambiar.error}
        errorMessage={adminErrorMessage(cambiar.error, 'roles')}
        onConfirm={confirmRole}
        onClose={closeConfirm}
      >
        {target && (
          <>
            <p>
              {removing ? 'Vas a quitar el rol de administrador a ' : 'Vas a dar el rol de administrador a '}
              <strong>{target.correo}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">El cambio se aplica cuando esa persona inicie sesión de nuevo.</p>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
