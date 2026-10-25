import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { Cliente } from './cliente.entity';

/** A role an account can hold (CUSTOMER, ADMIN). A catalog, so a typo cannot invent a role. */
@Entity('ecom_roles')
export class Rol {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  codigo: string;

  @Column({ type: 'varchar', length: 100 })
  descripcion: string;
}

/** The roles of an account, one row each. They travel in the JWT, so a change applies at the next sign-in. */
@Entity('ecom_cliente_roles')
export class ClienteRol {
  @PrimaryColumn({ type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Cliente, (c) => c.rolesRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Relation<Cliente>;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  rol: string;

  @ManyToOne(() => Rol, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rol' })
  rolRef?: Relation<Rol>;
}
