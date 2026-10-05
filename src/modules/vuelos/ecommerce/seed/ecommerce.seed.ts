import { randomInt } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { Cliente } from '../identidad/entities/cliente.entity';
import { hashPassword } from '../identidad/password.util';
import { Mercado } from '../mercados/entities/mercado.entity';
import { PlantillaNotificacion } from '../notificaciones/entities/plantilla.entity';
import { normalizarTexto } from '../common/texto.util';

// All values below are EXAMPLE data for the prototype (legal entities, URLs, instalment plans,
// exchange rate). Real values come from the business through the admin API (RF-ADM-001).
const MERCADOS: Partial<Mercado>[] = [
  {
    codigo: 'ec',
    pais: 'EC',
    nombre: 'Ecuador',
    idiomas: ['es'],
    idiomaPorDefecto: 'es',
    moneda: 'USD',
    tipoCambioDesdeUsd: 1,
    productosBuscador: ['VUELOS', 'PAQUETES', 'ALOJAMIENTOS', 'CARROS', 'UPGRADE', 'ESIM', 'UNIVERSAL'],
    // RF-PAY-002: Visa, Mastercard and Amex everywhere; Diners in EC, CO, BR, CL and AR.
    mediosPago: [{ tipo: 'TARJETA', marcas: ['VISA', 'MASTERCARD', 'AMEX', 'DINERS'], cuotasPermitidas: [1, 3, 6, 12], productos: ['PASAJE', 'ADICIONAL'] }],
    // A-13 (arrepentimiento in Ecuador) is an open legal question: nothing configured yet.
    reglasRegulatorias: {},
    textosLegales: {
      razonSocial: 'Booking Hub Vuelos Ecuador S.A. (dato de ejemplo)',
      terminos: { version: '2026-10', url: 'https://www.example.com/ec/es/terminos' },
      privacidad: { version: '2026-10', url: 'https://www.example.com/ec/es/privacidad' },
      condicionesTransporte: { version: '2026-10', url: 'https://www.example.com/ec/es/condiciones-de-transporte' },
    },
    identificacionesFiscales: [
      { tipo: 'CEDULA', etiqueta: 'Cédula (10 dígitos)', patron: '\\d{10}' },
      { tipo: 'RUC', etiqueta: 'RUC (13 dígitos)', patron: '\\d{13}' },
      { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '[A-Za-z0-9]{5,20}' },
    ],
    activo: true,
  },
  {
    codigo: 'co',
    pais: 'CO',
    nombre: 'Colombia',
    idiomas: ['es'],
    idiomaPorDefecto: 'es',
    moneda: 'COP',
    tipoCambioDesdeUsd: 4000,
    productosBuscador: ['VUELOS', 'PAQUETES', 'ALOJAMIENTOS', 'CARROS', 'ASISTENCIA', 'UPGRADE', 'ESIM'],
    mediosPago: [{ tipo: 'TARJETA', marcas: ['VISA', 'MASTERCARD', 'AMEX', 'DINERS'], cuotasPermitidas: [1, 3, 6, 12, 24, 36], productos: ['PASAJE', 'ADICIONAL'] }],
    // RF-MKT-007 / RN-23 / RN-24: stored for the post-sale release; not consumed in R1.
    reglasRegulatorias: {
      retracto: { diasHabiles: 5 },
      desistimiento: { retencionPorcentaje: 10, horasAntesDelVuelo: 24, familias: ['FULL', 'STANDARD'] },
    },
    textosLegales: {
      razonSocial: 'Booking Hub Vuelos Colombia S.A.S. (dato de ejemplo)',
      terminos: { version: '2026-10', url: 'https://www.example.com/co/es/terminos' },
      privacidad: { version: '2026-10', url: 'https://www.example.com/co/es/privacidad' },
      condicionesTransporte: { version: '2026-10', url: 'https://www.example.com/co/es/condiciones-de-transporte' },
    },
    identificacionesFiscales: [
      { tipo: 'CC', etiqueta: 'Cédula de ciudadanía', patron: '\\d{6,10}' },
      { tipo: 'NIT', etiqueta: 'NIT (sin dígito de verificación)', patron: '\\d{9,10}' },
      { tipo: 'CE', etiqueta: 'Cédula de extranjería', patron: '\\d{6,7}' },
      { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '[A-Za-z0-9]{5,20}' },
    ],
    activo: true,
  },
];

type LocalidadSeed = [iata: string, ciudad: string, nombre: string, pais: string, paisNombre: string, zona: string];

const LOCALIDADES: LocalidadSeed[] = [
  ['BOG', 'Bogotá', 'El Dorado', 'CO', 'Colombia', 'America/Bogota'],
  ['MDE', 'Medellín', 'José María Córdova', 'CO', 'Colombia', 'America/Bogota'],
  ['CLO', 'Cali', 'Alfonso Bonilla Aragón', 'CO', 'Colombia', 'America/Bogota'],
  ['CTG', 'Cartagena', 'Rafael Núñez', 'CO', 'Colombia', 'America/Bogota'],
  ['UIO', 'Quito', 'Mariscal Sucre', 'EC', 'Ecuador', 'America/Guayaquil'],
  ['GYE', 'Guayaquil', 'José Joaquín de Olmedo', 'EC', 'Ecuador', 'America/Guayaquil'],
  ['CUE', 'Cuenca', 'Mariscal Lamar', 'EC', 'Ecuador', 'America/Guayaquil'],
  ['GPS', 'Galápagos', 'Seymour (Baltra)', 'EC', 'Ecuador', 'Pacific/Galapagos'],
  ['LIM', 'Lima', 'Jorge Chávez', 'PE', 'Perú', 'America/Lima'],
  ['CUZ', 'Cusco', 'Alejandro Velasco Astete', 'PE', 'Perú', 'America/Lima'],
  ['SCL', 'Santiago', 'Arturo Merino Benítez', 'CL', 'Chile', 'America/Santiago'],
  ['EZE', 'Buenos Aires', 'Ministro Pistarini (Ezeiza)', 'AR', 'Argentina', 'America/Argentina/Buenos_Aires'],
  ['AEP', 'Buenos Aires', 'Jorge Newbery (Aeroparque)', 'AR', 'Argentina', 'America/Argentina/Buenos_Aires'],
  ['GRU', 'São Paulo', 'Guarulhos', 'BR', 'Brasil', 'America/Sao_Paulo'],
  ['GIG', 'Río de Janeiro', 'Galeão', 'BR', 'Brasil', 'America/Sao_Paulo'],
  ['MVD', 'Montevideo', 'Carrasco', 'UY', 'Uruguay', 'America/Montevideo'],
  ['ASU', 'Asunción', 'Silvio Pettirossi', 'PY', 'Paraguay', 'America/Asuncion'],
  ['LPB', 'La Paz', 'El Alto', 'BO', 'Bolivia', 'America/La_Paz'],
  ['PTY', 'Ciudad de Panamá', 'Tocumen', 'PA', 'Panamá', 'America/Panama'],
  ['MEX', 'Ciudad de México', 'Benito Juárez', 'MX', 'México', 'America/Mexico_City'],
  ['CUN', 'Cancún', 'Cancún', 'MX', 'México', 'America/Cancun'],
  ['MIA', 'Miami', 'Miami International', 'US', 'Estados Unidos', 'America/New_York'],
  ['JFK', 'Nueva York', 'John F. Kennedy', 'US', 'Estados Unidos', 'America/New_York'],
  ['MAD', 'Madrid', 'Adolfo Suárez Madrid-Barajas', 'ES', 'España', 'Europe/Madrid'],
];

const PIE = '\n\n{{razonSocial}}\nTérminos y condiciones: {{urlTerminos}}';

const PLANTILLAS: Partial<PlantillaNotificacion>[] = [
  {
    tipo: 'CONFIRMACION_COMPRA',
    idioma: 'es',
    version: 1,
    asunto: 'Confirmación de tu compra {{numeroOrden}}',
    cuerpo:
      'Hola {{nombre}},\n\n¡Tu compra fue confirmada!\n\nNúmero de orden: {{numeroOrden}}\nCódigo de reserva (PNR): {{pnr}}\n\nItinerario:\n{{itinerario}}\n\nPasajeros y billetes electrónicos:\n{{pasajeros}}\n\nTotal pagado: {{total}}\n\nPuedes gestionar tu viaje con el número de orden o el código de reserva y el apellido del pasajero.' +
      PIE,
  },
  {
    tipo: 'CONFIRMACION_COMPRA',
    idioma: 'en',
    version: 1,
    asunto: 'Your purchase {{numeroOrden}} is confirmed',
    cuerpo:
      'Hello {{nombre}},\n\nYour purchase is confirmed!\n\nOrder number: {{numeroOrden}}\nBooking reference (PNR): {{pnr}}\n\nItinerary:\n{{itinerario}}\n\nPassengers and e-tickets:\n{{pasajeros}}\n\nTotal paid: {{total}}\n\nManage your trip with the order number or booking reference and the passenger surname.' +
      PIE,
  },
  {
    tipo: 'EMISION_FALLIDA',
    idioma: 'es',
    version: 1,
    asunto: 'No pudimos emitir tu orden {{numeroOrden}}',
    cuerpo:
      'Hola,\n\nNo pudimos emitir los billetes de tu orden {{numeroOrden}}. La autorización de tu pago fue liberada: no se te cobró.\n\nPuedes volver a intentar la compra o elegir otro vuelo.' +
      PIE,
  },
  {
    tipo: 'VERIFICACION_CORREO',
    idioma: 'es',
    version: 1,
    asunto: 'Confirma tu correo',
    cuerpo: 'Hola {{nombre}},\n\nConfirma tu correo con este enlace (vale 24 horas):\n{{enlace}}\n\nSi no creaste una cuenta, ignora este mensaje.' + PIE,
  },
  {
    tipo: 'CUENTA_BLOQUEADA',
    idioma: 'es',
    version: 1,
    asunto: 'Bloqueamos temporalmente tu cuenta',
    cuerpo:
      'Hola {{nombre}},\n\nDetectamos varios intentos fallidos de inicio de sesión y bloqueamos tu cuenta por {{minutos}} minutos. Si no fuiste tú, recupera tu acceso.' + PIE,
  },
];

/**
 * Idempotent and non-destructive: reference data is inserted only when missing, so a re-run (the
 * deployment runs this on every start) never overwrites what an admin edited through the API.
 */
export async function seedEcommerce(dataSource: DataSource, admin?: { correo: string; contrasena: string }): Promise<Record<string, number>> {
  const mercados = await dataSource.createQueryBuilder().insert().into(Mercado).values(MERCADOS as Mercado[]).orIgnore().returning('"codigo"').execute();

  const localidades = await dataSource
    .createQueryBuilder()
    .insert()
    .into(Localidad)
    .values(
      LOCALIDADES.map(([iata, ciudad, nombre, pais, paisNombre, zonaHoraria]) => ({
        iata,
        ciudad,
        nombre,
        pais,
        paisNombre,
        zonaHoraria,
        ciudadNorm: normalizarTexto(ciudad),
        nombreNorm: normalizarTexto(nombre),
      })),
    )
    .orIgnore()
    .returning('"iata"')
    .execute();

  const repoPlantillas = dataSource.getRepository(PlantillaNotificacion);
  let plantillas = 0;
  for (const plantilla of PLANTILLAS) {
    const existe = await repoPlantillas.exist({ where: { tipo: plantilla.tipo, idioma: plantilla.idioma, version: plantilla.version } });
    if (!existe) {
      await repoPlantillas.save(repoPlantillas.create({ ...plantilla, mercado: null, activa: true }));
      plantillas++;
    }
  }

  let administradores = 0;
  if (admin) {
    const repoClientes = dataSource.getRepository(Cliente);
    if (!(await repoClientes.exist({ where: { correo: admin.correo.toLowerCase() } }))) {
      let digits = '';
      for (let i = 0; i < 9; i++) digits += randomInt(10).toString();
      await repoClientes.save(
        repoClientes.create({
          correo: admin.correo.toLowerCase(),
          correoVerificado: true,
          hashContrasena: await hashPassword(admin.contrasena),
          nombres: 'Admin',
          apellidos: 'Sistema',
          fechaNacimiento: '1990-01-01',
          telefono: null,
          numeroSocio: `LP${digits}`,
          mercadoPreferido: 'ec',
          idiomaPreferido: 'es',
          terminosVersionAceptada: '2026-10',
          terminosAceptadosEn: new Date(),
          roles: ['CUSTOMER', 'ADMIN'],
        }),
      );
      administradores = 1;
    }
  }

  return {
    mercados: Array.isArray(mercados.raw) ? mercados.raw.length : 0,
    localidades: Array.isArray(localidades.raw) ? localidades.raw.length : 0,
    plantillas,
    administradores,
  };
}
