import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, ShieldCheck, UserPlus, Users } from 'lucide-react';
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
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { useToast } from '../../lib/toast';
import { AdminPageHeader } from './AdminPageHeader';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { newUserSchema, type NewUserForm } from './admin-schemas';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Mounted only while open, so the form and the mutation start clean every time. */
const CreateUserDialog: React.FC<{ onClose: () => void; onCreated: (correo: string) => void }> = ({ onClose, onCreated }) => {
  const crear = useCrearUsuario();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewUserForm>({ resolver: zodResolver(newUserSchema), defaultValues: { esAdmin: false } });

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
    <Dialog isOpen onClose={onClose} title="Crear usuario" description="La cuenta nace con el correo verificado." maxWidth="lg">
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
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register('esAdmin')} />
          <span>
            Darle también el rol <strong>Administrador</strong>
            <span className="block text-xs text-muted">Podrá ver órdenes, gestionar vuelos y otros usuarios.</span>
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
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<AdminUsuario | null>(null);
  const toast = useToast();
  const debouncedQ = useDebounced(q.trim(), 350);

  // The page belongs to one set of filters: changing the search or the role goes back to page 1.
  const filterKey = `${debouncedQ}|${rol}`;
  const [page, setPage] = useState({ key: filterKey, n: 1 });
  const pagina = page.key === filterKey ? page.n : 1;
  const setPagina = (next: (current: number) => number) => setPage({ key: filterKey, n: next(pagina) });

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
          toast.success(
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
      <AdminPageHeader page="usuarios" description="Quién puede entrar al panel y con qué rol." />
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-gold-soft p-3 text-small text-ink" role="note">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Los cambios de rol se aplican cuando la persona <strong>inicia sesión de nuevo</strong>: su sesión actual conserva los roles que tenía hasta que expire.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_14rem_auto]">
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

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <Table label="Usuarios registrados" className="min-w-[820px]" aria-busy={isFetching}>
        <TableHead>
          <tr>
            <TableHeaderCell>Usuario</TableHeaderCell>
            <TableHeaderCell>Rol</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Creado (hora de Ecuador)</TableHeaderCell>
            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading && (
            <tr>
              <td colSpan={5} className="p-4">
                <div role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </div>
              </td>
            </tr>
          )}
          {users.map((u) => {
            const admin = esAdministrador(u);
            const isSelf = u.clienteId === myId;
            const selfBlocked = admin && isSelf;
            const hintId = `self-${u.clienteId}`;
            const lockId = `lock-${u.clienteId}`;
            return (
              <TableRow key={u.clienteId}>
                <TableCell>
                  <p className="font-semibold text-ink">
                    {u.nombres} {u.apellidos}
                    {isSelf && <span className="ml-2 text-small font-normal text-muted">(tú)</span>}
                  </p>
                  <p className="text-small text-muted">{u.correo}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={admin ? 'primary' : 'secondary'}>{admin ? 'Administrador' : 'Cliente'}</Badge>
                </TableCell>
                <TableCell className="text-small text-muted">
                  {u.bloqueada ? (
                    <div>
                      <Badge variant="danger" aria-describedby={lockId}>
                        Bloqueada
                      </Badge>
                      <p id={lockId} className="mt-1 max-w-[16rem]">
                        Se desbloquea sola cuando termina el tiempo de bloqueo; no hace falta ninguna acción.
                      </p>
                    </div>
                  ) : u.correoVerificado ? (
                    'Correo verificado'
                  ) : (
                    'Correo sin verificar'
                  )}
                </TableCell>
                <TableCell className="num text-small text-muted">{formatAdminDateTime(u.creadoEn)}</TableCell>
                <TableCell className="text-right">
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
                    <p id={hintId} className="mt-1 text-small text-muted">
                      No puedes quitarte tu propio rol de administrador.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!isLoading && users.length === 0 && !error && (
        <EmptyState icon={<Users />} title="No hay usuarios con estos filtros" description="Cambia la búsqueda o el rol." />
      )}

      <nav aria-label="Paginación de usuarios" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
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

      {creating && <CreateUserDialog onClose={() => setCreating(false)} onCreated={(correo) => toast.success(`Usuario ${correo} creado.`)} />}

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
            <p className="mt-2 text-xs text-muted">El cambio se aplica cuando esa persona inicie sesión de nuevo.</p>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
