import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, PrototypeNotice } from './LegalLayout';

export const TransportConditionsPage: React.FC = () => (
  <LegalLayout title="Condiciones de transporte" intro="Reglas del contrato de transporte aéreo de los vuelos que se venden en RAM Alliance.">
    <PrototypeNotice />

    <h2>1. Alcance</h2>
    <p>Estas condiciones se aplican a los vuelos directos, en clase económica, vendidos en este sitio. Cada vuelo es operado por la aerolínea que aparece en el itinerario (aerolínea operadora).</p>

    <h2>2. Documentos de viaje</h2>
    <ul>
      <li>Cada pasajero debe viajar con el documento (pasaporte o documento nacional de identidad) que registró en la compra, válido durante todo el viaje.</li>
      <li>Es responsabilidad del pasajero cumplir los requisitos migratorios, sanitarios y de visado del país de destino y de tránsito.</li>
      <li>Los nombres deben coincidir exactamente con el documento. Corregirlos puede tener costo o no ser posible.</li>
    </ul>

    <h2>3. Pasajeros menores</h2>
    <ul>
      <li>Infante: menos de 2 años a la fecha del primer vuelo; viaja en brazos de un adulto, sin asiento propio.</li>
      <li>Niño: de 2 a 11 años. Joven: de 12 a 17 años.</li>
      <li>La edad se evalúa en la fecha del primer vuelo del viaje. Los menores deben cumplir los requisitos de viaje de cada país.</li>
    </ul>

    <h2>4. Equipaje</h2>
    <p>El equipaje permitido depende de la familia tarifaria contratada: BASIC sin equipaje incluido, LIGHT con 10 kg de mano, FULL con 10 kg de mano y una pieza de bodega. Consulta la tabla en <Link to="/transparencia#familias">Transparencia</Link>. El equipaje adicional se podrá contratar cuando esa función esté disponible.</p>

    <h2>5. Presentación en el aeropuerto</h2>
    <ul>
      <li>Vuelos nacionales o regionales: presentarse al menos 2 horas antes de la salida.</li>
      <li>Vuelos intercontinentales: presentarse al menos 3 horas antes.</li>
      <li>El embarque se cierra antes de la hora de salida; quien llegue tarde puede perder su vuelo sin derecho a reembolso.</li>
    </ul>

    <h2>6. Cambios, cancelaciones y reembolsos</h2>
    <p>Dependen de la familia tarifaria. BASIC y LIGHT no admiten cambios ni reembolsos; FULL permite cambios y es reembolsable. En esta versión estas gestiones no están disponibles en línea.</p>

    <h2>7. Cambios y cancelaciones por parte de la aerolínea</h2>
    <p>Los horarios pueden cambiar. Si la aerolínea cancela o modifica de forma significativa un vuelo, el pasajero podrá aceptar una alternativa o solicitar el reembolso del tramo no utilizado, según la normativa aplicable.</p>

    <h2>8. Responsabilidad del transportista</h2>
    <p>La responsabilidad por daños, retrasos y equipaje se rige por el Convenio de Montreal de 1999 y la normativa aeronáutica de los países involucrados, en lo que corresponda.</p>

    <h2>9. Aceptación</h2>
    <p>Para comprar debes aceptar estas condiciones y los <Link to="/terminos">Términos de uso</Link>. Se registra la versión aceptada junto con tu orden.</p>
  </LegalLayout>
);
