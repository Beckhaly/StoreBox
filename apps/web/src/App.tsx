import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth, useCan } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import type { PermissionModule } from '@storebox/shared';

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
const LotsPage         = lazy(() => import('./pages/LotsPage'));
const BonCommandePage  = lazy(() => import('./pages/BonCommandePage'));
const DepensesPage     = lazy(() => import('./pages/DepensesPage'));
const MagasinsPage     = lazy(() => import('./pages/MagasinsPage'));
const CaissePage         = lazy(() => import('./pages/CaissePage'));
const CaisseSessionsPage = lazy(() => import('./pages/CaisseSessionsPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));

// Garde d'authentification
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Écran d'accès refusé (droit manquant)
function AccessDenied() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-red-500">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Accès refusé</h2>
        <p className="text-sm text-slate-500">Vous n'avez pas les droits nécessaires pour cette section. Contactez votre administrateur.</p>
      </div>
    </div>
  );
}

// Garde de droit : bloque l'accès direct si le module n'est pas autorisé
function Guard({ perm, children }: { perm: PermissionModule | 'admin'; children: JSX.Element }) {
  const can = useCan();
  return can(perm) ? children : <AccessDenied />;
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
        <Route index element={<Guard perm="dashboard"><DashboardPage /></Guard>} />
        <Route path="profil"       element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
        <Route path="produits"     element={<Guard perm="produits"><Suspense fallback={<PageLoader />}><ProduitsPage /></Suspense></Guard>} />
        <Route path="clients"      element={<Guard perm="clients"><Suspense fallback={<PageLoader />}><ClientsPage /></Suspense></Guard>} />
        <Route path="ventes"       element={<Guard perm="ventes"><Suspense fallback={<PageLoader />}><VentesPage /></Suspense></Guard>} />
        <Route path="creances"     element={<Guard perm="creances"><CreancesPage /></Guard>} />
        <Route path="dettes"       element={<Guard perm="dettes"><Suspense fallback={<PageLoader />}><DettesPage /></Suspense></Guard>} />
        <Route path="echeances"    element={<Guard perm="echeances"><Suspense fallback={<PageLoader />}><EcheancesPage /></Suspense></Guard>} />
        <Route path="fournisseurs" element={<Guard perm="fournisseurs"><Suspense fallback={<PageLoader />}><FournisseursPage /></Suspense></Guard>} />
        <Route path="achats"       element={<Guard perm="achats"><Suspense fallback={<PageLoader />}><AchatsPage /></Suspense></Guard>} />
        <Route path="rapports"     element={<Guard perm="rapports"><Suspense fallback={<PageLoader />}><RapportsPage /></Suspense></Guard>} />
        <Route path="devis"        element={<Guard perm="devis"><Suspense fallback={<PageLoader />}><DevisPage /></Suspense></Guard>} />
        <Route path="retours"      element={<Guard perm="retours"><Suspense fallback={<PageLoader />}><RetoursPage /></Suspense></Guard>} />
        <Route path="stock"        element={<Guard perm="stock"><Suspense fallback={<PageLoader />}><StockPage /></Suspense></Guard>} />
        <Route path="lots"         element={<Guard perm="stock"><Suspense fallback={<PageLoader />}><LotsPage /></Suspense></Guard>} />
        <Route path="bons-commande" element={<Guard perm="commandes"><Suspense fallback={<PageLoader />}><BonCommandePage /></Suspense></Guard>} />
        <Route path="depenses"      element={<Guard perm="depenses"><Suspense fallback={<PageLoader />}><DepensesPage /></Suspense></Guard>} />
        <Route path="magasins"     element={<Guard perm="admin"><Suspense fallback={<PageLoader />}><MagasinsPage /></Suspense></Guard>} />
        <Route path="caisse"         element={<Guard perm="caisse"><Suspense fallback={<PageLoader />}><CaissePage /></Suspense></Guard>} />
        <Route path="caisse/sessions" element={<Guard perm="caisse"><Suspense fallback={<PageLoader />}><CaisseSessionsPage /></Suspense></Guard>} />
        <Route path="admin"        element={<Guard perm="admin"><Suspense fallback={<PageLoader />}><AdminPage /></Suspense></Guard>} />
        <Route path="admin/referentiels" element={<Guard perm="admin"><Suspense fallback={<PageLoader />}><AdminReferentielsPage /></Suspense></Guard>} />
        <Route path="admin/societe" element={<Guard perm="admin"><Suspense fallback={<PageLoader />}><AdminSocietePage /></Suspense></Guard>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
