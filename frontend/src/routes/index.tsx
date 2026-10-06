import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { WakeUpBanner } from '../components/common/WakeUpBanner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { HomePage } from '../features/search/HomePage';
import { ResultsPage } from '../features/results/ResultsPage';
import { CheckoutPage } from '../features/checkout/CheckoutPage';
import { ConfirmationPage } from '../features/confirmation/ConfirmationPage';
import { RetrieveOrderPage } from '../features/orders/RetrieveOrderPage';
import { VerifyTicketPage } from '../features/verify/VerifyTicketPage';
import { OrderHistoryPage } from '../features/account/OrderHistoryPage';
import { LoginPage } from '../features/account/LoginPage';
import { RegisterPage } from '../features/account/RegisterPage';
import { VerifyEmailPage } from '../features/account/VerifyEmailPage';
import { ProfilePage } from '../features/account/ProfilePage';
import { TransparencyPage } from '../features/legal/TransparencyPage';
import { TermsPage } from '../features/legal/TermsPage';
import { PrivacyPage } from '../features/legal/PrivacyPage';
import { TransportConditionsPage } from '../features/legal/TransportConditionsPage';
import { HelpPage } from '../features/legal/HelpPage';
import { AdminLayout } from '../features/admin/AdminLayout';
import { AdminOrdersPage } from '../features/admin/AdminOrdersPage';
import { AdminFlightsPage } from '../features/admin/AdminFlightsPage';
import { AdminObservabilityPage } from '../features/admin/AdminObservabilityPage';
import { RequireAdmin, RequireCustomer } from './guards';
import { RouteEffects } from './RouteEffects';
import { NotFoundPage } from './NotFoundPage';

const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <RouteEffects />
      <Header />
      <WakeUpBanner />
      <main id="contenido" className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultados" element={<ResultsPage />} />
        <Route path="/checkout/:offerId" element={<CheckoutPage />} />
        <Route path="/confirmacion/:orderNumber" element={<ConfirmationPage />} />
        <Route path="/recuperar-orden" element={<RetrieveOrderPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/verificar-correo" element={<VerifyEmailPage />} />

        <Route element={<RequireCustomer />}>
          <Route path="/mis-ordenes" element={<OrderHistoryPage />} />
          <Route path="/mi-cuenta" element={<ProfilePage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOrdersPage />} />
            <Route path="ordenes" element={<AdminOrdersPage />} />
            <Route path="vuelos" element={<AdminFlightsPage />} />
            <Route path="observabilidad" element={<AdminObservabilityPage />} />
          </Route>
        </Route>

        <Route path="/verificar/:codigo" element={<VerifyTicketPage />} />

        <Route path="/transparencia" element={<TransparencyPage />} />
        <Route path="/condiciones-transporte" element={<TransportConditionsPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        <Route path="/ayuda" element={<HelpPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
