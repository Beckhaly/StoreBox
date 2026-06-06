import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import LoginPage      from './pages/LoginPage';
import DashboardPage  from './pages/DashboardPage';
import CreancesPage   from './pages/CreancesPage';

// Lazy imports pour les autres pages
import { lazy, Suspense } from 'react';
import { Spinner } from './components/ui';

const ProduitsPage     = lazy(() => import('./pages/ProduitsPage'));
const ClientsPage      = lazy(() => import('./pages/ClientsPage'));
const VentesPage       = lazy(() => import('./pages/VentesPage'));
const DettesPage       = lazy(() => import('./pages/DettesPage'));
const EcheancesPage    = lazy(() => import('./pages/EcheancesPage'));
const FournisseursPage = lazy(() => import('./pages/FournisseursPage'));
const AchatsPage       = lazy(() => import('./pages/AchatsPage'));
const RapportsPage     = lazy(() => import('./pages/RapportsPage'));
const AdminPage        = lazy(() => import('./pages/AdminPage'));
const AdminReferentielsPage = lazy(() => import('./pages/AdminReferentielsPage'));
const AdminSocietePage = lazy(() => import('./pages/AdminSocietePage'));
const DevisPage        = lazy(() => import('./pages/DevisPage'));
const RetoursPage      = lazy(() => import('./pages/RetoursPage'));
const StockPage        = lazy(() => import('./pages/StockPage'));
const BonCommandePage  = lazy(() => import('./pages/BonCommandePage'));
const DepensesPage     = lazy(() => import('./pages/DepensesPage'));
const MagasinsPage     = lazy(() => import('./pages/MagasinsPage'));
const CaissePage         = lazy(() => import('./pages/CaissePage'));
const CaisseSessionsPage = lazy(() => import('./pages/CaisseSessionsPage'));

// Garde d'authentification
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  const { init } = useAuth();
  useEffect(() => { init(); }, [init]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="produits"     element={<Suspense fallback={<PageLoader />}><ProduitsPage /></Suspense>} />
        <Route path="clients"      element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
        <Route path="ventes"       element={<Suspense fallback={<PageLoader />}><VentesPage /></Suspense>} />
        <Route path="creances"     element={<CreancesPage />} />
        <Route path="dettes"       element={<Suspense fallback={<PageLoader />}><DettesPage /></Suspense>} />
        <Route path="echeances"    element={<Suspense fallback={<PageLoader />}><EcheancesPage /></Suspense>} />
        <Route path="fournisseurs" element={<Suspense fallback={<PageLoader />}><FournisseursPage /></Suspense>} />
        <Route path="achats"       element={<Suspense fallback={<PageLoader />}><AchatsPage /></Suspense>} />
        <Route path="rapports"     element={<Suspense fallback={<PageLoader />}><RapportsPage /></Suspense>} />
        <Route path="devis"        element={<Suspense fallback={<PageLoader />}><DevisPage /></Suspense>} />
        <Route path="retours"      element={<Suspense fallback={<PageLoader />}><RetoursPage /></Suspense>} />
        <Route path="stock"        element={<Suspense fallback={<PageLoader />}><StockPage /></Suspense>} />
        <Route path="bons-commande" element={<Suspense fallback={<PageLoader />}><BonCommandePage /></Suspense>} />
        <Route path="depenses"      element={<Suspense fallback={<PageLoader />}><DepensesPage /></Suspense>} />
        <Route path="magasins"     element={<Suspense fallback={<PageLoader />}><MagasinsPage /></Suspense>} />
        <Route path="caisse"         element={<Suspense fallback={<PageLoader />}><CaissePage /></Suspense>} />
        <Route path="caisse/sessions" element={<Suspense fallback={<PageLoader />}><CaisseSessionsPage /></Suspense>} />
        <Route path="admin"        element={<Suspense fallback={<PageLoader />}><AdminPage /></Suspense>} />
        <Route path="admin/referentiels" element={<Suspense fallback={<PageLoader />}><AdminReferentielsPage /></Suspense>} />
        <Route path="admin/societe" element={<Suspense fallback={<PageLoader />}><AdminSocietePage /></Suspense>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
