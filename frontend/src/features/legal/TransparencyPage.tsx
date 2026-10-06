import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, PrototypeNotice } from './LegalLayout';

export const TransparencyPage: React.FC = () => (
  <LegalLayout
    title="Transparencia"
    intro="Cómo se forma el precio que ves, qué incluye cada tarifa y qué puedes esperar de tu compra, explicado sin letra pequeña."
  >
    <PrototypeNotice />

    <h2 id="precio">1. Cómo se calcula el precio</h2>
    <p>El total que pagas se compone de tres partes, siempre en dólares estadounidenses (USD):</p>
    <ul>
      <li><strong>Tarifa base:</strong> el precio del vuelo para un adulto en el día elegido. Varía según la ruta y el día de la semana.</li>
      <li><strong>Familia tarifaria:</strong> BASIC, LIGHT o FULL. Cada una aplica un factor sobre la tarifa base (ver tabla más abajo).</li>
      <li><strong>Impuestos y cargos:</strong> se calculan sobre la tarifa y se muestran siempre separados antes de pagar.</li>
    </ul>
    <p>El importe se calcula por pasajero según su edad en la fecha del primer vuelo y se muestra desglosado en el resumen de tu reserva. No hay cargos ocultos: el total del resumen es lo que se cobra.</p>

    <h3>Pasajeros y edades</h3>
    <table>
      <thead><tr><th>Tipo</th><th>Edad al primer vuelo</th><th>Factor sobre la tarifa</th></tr></thead>
      <tbody>
        <tr><td>Adulto</td><td>18 años o más</td><td>100 %</td></tr>
        <tr><td>Joven</td><td>12 a 17 años</td><td>100 %</td></tr>
        <tr><td>Niño</td><td>2 a 11 años</td><td>75 %</td></tr>
        <tr><td>Infante (sin asiento)</td><td>Menos de 2 años</td><td>10 %</td></tr>
      </tbody>
    </table>
    <p>Cada infante viaja en brazos de un adulto: no puede haber más infantes que adultos en una reserva. Los porcentajes y las bandas de edad son valores provisionales del prototipo.</p>

    <h2 id="familias">2. Qué incluye cada familia tarifaria</h2>
    <table>
      <thead><tr><th>Condición</th><th>BASIC</th><th>LIGHT</th><th>FULL</th></tr></thead>
      <tbody>
        <tr><td>Factor sobre la tarifa base</td><td>1,00</td><td>1,15</td><td>1,35</td></tr>
        <tr><td>Equipaje de mano</td><td>No incluido</td><td>10 kg</td><td>10 kg</td></tr>
        <tr><td>Equipaje de bodega</td><td>No incluido</td><td>No incluido</td><td>1 pieza</td></tr>
        <tr><td>Cambios de fecha</td><td>No permitidos</td><td>No permitidos</td><td>Permitidos</td></tr>
        <tr><td>Reembolso</td><td>No reembolsable</td><td>No reembolsable</td><td>Reembolsable</td></tr>
        <tr><td>Selección de asiento</td><td>No incluida</td><td>No incluida</td><td>Incluida</td></tr>
      </tbody>
    </table>
    <p>La familia se elige por tramo antes de pagar y queda registrada en tu orden.</p>

    <h2 id="reserva">3. Tiempo de reserva y cambios de precio</h2>
    <ul>
      <li>Al armar tu reserva, retenemos los asientos durante <strong>15 minutos</strong> mientras completas tus datos. Verás una cuenta regresiva.</li>
      <li>Antes de cobrar volvemos a verificar precio y disponibilidad. Si el precio cambió, te mostramos el valor anterior y el nuevo, y no se cobra nada hasta que lo aceptes.</li>
      <li>Si el tiempo termina, la reserva se libera y debes buscar de nuevo. No se genera ningún cobro.</li>
    </ul>

    <h2 id="pago">4. Pagos</h2>
    <ul>
      <li>Este sitio usa una pasarela de pago <strong>simulada</strong>. No ingreses datos reales de tu tarjeta: no se cobra ni se procesa dinero.</li>
      <li>Si un pago es rechazado, tu reserva sigue vigente el tiempo restante y puedes intentar con otro medio.</li>
      <li>Si el pago se aprueba pero el boleto no puede emitirse, la autorización se libera y no se te cobra.</li>
      <li>Reintentar un pago no genera un segundo cobro ni una segunda orden.</li>
    </ul>

    <h2 id="cambios">5. Cambios, cancelaciones y reembolsos</h2>
    <p>Las condiciones dependen de la familia tarifaria (ver tabla). En esta versión del prototipo los cambios, cancelaciones y reembolsos <strong>aún no se pueden gestionar en línea</strong>; la función estará disponible en una próxima etapa del proyecto.</p>

    <h2 id="contacto-transparencia">6. Dónde ver y recuperar tu viaje</h2>
    <p>Con una cuenta, tus viajes aparecen en «Mis viajes». Sin cuenta, puedes recuperarlos en <Link to="/recuperar-orden">Gestionar viaje</Link> con el número de orden o el código de reserva y un apellido de los pasajeros.</p>

    <p>Más información: <Link to="/condiciones-transporte">Condiciones de transporte</Link>, <Link to="/terminos">Términos de uso</Link>, <Link to="/privacidad">Política de privacidad</Link> y <Link to="/ayuda">Ayuda</Link>.</p>
  </LegalLayout>
);
