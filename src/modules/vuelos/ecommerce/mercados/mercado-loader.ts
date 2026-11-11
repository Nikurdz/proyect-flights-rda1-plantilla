import { HttpStatus } from '@nestjs/common';
import { EntityManager, EntityTarget, In } from 'typeorm';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { FareFamily } from '../../entities/fare-family.entity';
import { ConfiguracionMercado, Mercado } from './entities/mercado.entity';
import {
  MercadoDocumentoLegal,
  MercadoIdentificacionFiscal,
  MercadoIdioma,
  MercadoMedioCuota,
  MercadoMedioMarca,
  MercadoMedioPago,
  MercadoMedioProducto,
  MercadoProducto,
  MercadoRegla,
  MercadoReglaFamilia,
} from './entities/mercado-config.entity';

/**
 * Attaches to a market the child rows its configuration getters read. Separate queries, not joins, so the market row
 * can be loaded under a lock (a lock cannot be applied to the outer side of a join) and one after another, because a
 * transaction has a single connection.
 */
export async function completarMercado(manager: EntityManager, mercado: Mercado): Promise<Mercado> {
  const where = { mercadoCodigo: mercado.codigo };
  mercado.idiomasRef = await manager.find(MercadoIdioma, { where });
  mercado.productosRef = await manager.find(MercadoProducto, { where });
  mercado.mediosPagoRef = await manager.find(MercadoMedioPago, { where, relations: { marcas: true, cuotas: true, productos: true } });
  mercado.reglasRef = await manager.find(MercadoRegla, { where, relations: { familias: true } });
  mercado.documentosRef = await manager.find(MercadoDocumentoLegal, { where });
  mercado.identificacionesRef = await manager.find(MercadoIdentificacionFiscal, { where });
  return mercado;
}

/** One market with its configuration attached; null when it does not exist. `lock` takes a write lock on the market row. */
export async function cargarMercado(manager: EntityManager, codigo: string, options: { lock?: boolean } = {}): Promise<Mercado | null> {
  const mercado = await manager.findOne(Mercado, { where: { codigo }, ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
  return mercado ? completarMercado(manager, mercado) : null;
}

const invalid = (field: string, reason: string) =>
  new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid market configuration', reason, [{ name: field, reason }]);

const duplicados = (valores: string[]) => valores.find((v, i) => valores.indexOf(v) !== i);

async function insertar<T extends object>(manager: EntityManager, entity: EntityTarget<T>, rows: object[]): Promise<void> {
  if (rows.length > 0) await manager.insert(entity, rows as never);
}

/**
 * Replaces the groups of configuration that are given (the ones left out stay as they are). Each group is rewritten as
 * a whole: delete its rows, insert the new ones. The caller runs this inside a transaction.
 */
export async function escribirConfiguracion(manager: EntityManager, codigo: string, config: Partial<ConfiguracionMercado>): Promise<void> {
  const mercadoCodigo = codigo;

  if (config.idiomas) {
    const repetido = duplicados(config.idiomas);
    if (repetido) throw invalid('idiomas', `language "${repetido}" is repeated`);
    await manager.delete(MercadoIdioma, { mercadoCodigo });
    await insertar(manager, MercadoIdioma, config.idiomas.map((idioma, orden) => ({ mercadoCodigo, idioma, orden })));
  }

  if (config.productosBuscador) {
    const repetido = duplicados(config.productosBuscador);
    if (repetido) throw invalid('productosBuscador', `product "${repetido}" is repeated`);
    await manager.delete(MercadoProducto, { mercadoCodigo });
    await insertar(manager, MercadoProducto, config.productosBuscador.map((producto, orden) => ({ mercadoCodigo, producto, orden })));
  }

  if (config.identificacionesFiscales) {
    const repetido = duplicados(config.identificacionesFiscales.map((i) => i.tipo));
    if (repetido) throw invalid('identificacionesFiscales', `tax id type "${repetido}" is repeated`);
    await manager.delete(MercadoIdentificacionFiscal, { mercadoCodigo });
    await insertar(manager, MercadoIdentificacionFiscal, config.identificacionesFiscales.map((i, orden) => ({ mercadoCodigo, tipo: i.tipo, etiqueta: i.etiqueta, patron: i.patron, orden })));
  }

  if (config.textosLegales) {
    const t = config.textosLegales;
    await manager.update(Mercado, { codigo }, { razonSocial: t.razonSocial });
    await manager.delete(MercadoDocumentoLegal, { mercadoCodigo });
    await insertar(manager, MercadoDocumentoLegal, [
      { mercadoCodigo, tipo: 'TERMINOS', version: t.terminos.version, url: t.terminos.url },
      { mercadoCodigo, tipo: 'PRIVACIDAD', version: t.privacidad.version, url: t.privacidad.url },
      { mercadoCodigo, tipo: 'CONDICIONES_TRANSPORTE', version: t.condicionesTransporte.version, url: t.condicionesTransporte.url },
    ]);
  }

  if (config.mediosPago) {
    const repetido = duplicados(config.mediosPago.map((m) => m.tipo));
    if (repetido) throw invalid('mediosPago', `payment method "${repetido}" is repeated`);
    await manager.delete(MercadoMedioPago, { mercadoCodigo }); // its brands, instalments and products go with it
    for (const [orden, medio] of config.mediosPago.entries()) {
      await manager.save(
        manager.create(MercadoMedioPago, {
          mercadoCodigo,
          tipo: medio.tipo,
          orden,
          marcas: [...new Set(medio.marcas)].map((marca, i) => manager.create(MercadoMedioMarca, { marca, orden: i })),
          cuotas: [...new Set(medio.cuotasPermitidas)].map((cuotas) => manager.create(MercadoMedioCuota, { cuotas })),
          productos: [...new Set(medio.productos)].map((producto) => manager.create(MercadoMedioProducto, { producto })),
        }),
      );
    }
  }

  if (config.reglasRegulatorias) {
    const r = config.reglasRegulatorias;
    const familias = r.desistimiento?.familias ?? [];
    if (familias.length > 0) {
      const conocidas = await manager.find(FareFamily, { where: { code: In(familias) }, select: { code: true } });
      const desconocida = familias.find((f) => !conocidas.some((c) => c.code === f));
      if (desconocida) throw invalid('reglasRegulatorias.desistimiento.familias', `fare family "${desconocida}" does not exist`);
    }
    await manager.delete(MercadoRegla, { mercadoCodigo }); // its families go with it
    const vacia = { diasHabiles: null, retencionPorcentaje: null, horasAntesDelVuelo: null, maximoPorPasaje: null, maximoPorAnio: null };
    if (r.retracto) await manager.save(manager.create(MercadoRegla, { ...vacia, mercadoCodigo, regla: 'RETRACTO', diasHabiles: r.retracto.diasHabiles }));
    if (r.desistimiento) {
      await manager.save(
        manager.create(MercadoRegla, {
          ...vacia,
          mercadoCodigo,
          regla: 'DESISTIMIENTO',
          retencionPorcentaje: r.desistimiento.retencionPorcentaje,
          horasAntesDelVuelo: r.desistimiento.horasAntesDelVuelo,
          familias: [...new Set(familias)].map((familia) => manager.create(MercadoReglaFamilia, { familia })),
        }),
      );
    }
    if (r.traspaso) {
      await manager.save(
        manager.create(MercadoRegla, {
          ...vacia,
          mercadoCodigo,
          regla: 'TRASPASO',
          horasAntesDelVuelo: r.traspaso.horasAntesDelVuelo,
          maximoPorPasaje: r.traspaso.maximoPorPasaje,
          maximoPorAnio: r.traspaso.maximoPorAnio,
        }),
      );
    }
  }
}
