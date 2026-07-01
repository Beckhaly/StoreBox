import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useCan } from '../../hooks/useAuth';
import { useMagasin } from '../../hooks/useMagasin';
import { SearchPalette } from '../ui/SearchPalette';
import { api } from '../../lib/api';
import type { Magasin, SocieteParametres, Utilisateur, PermissionModule } from '@storebox/shared';

type NavItemDef = { to: string; label: string; icon: string; alert?: boolean; perm?: PermissionModule };

const NAV: { section: string; items: NavItemDef[] }[] = [
  {
    section: 'Commercial',
    items: [
      { to: '/',             label: 'Tableau de bord',    icon: 'grid',  perm: 'dashboard' },
      { to: '/produits',     label: 'Produits & stock',   icon: 'box',   perm: 'produits' },
      { to: '/clients',      label: 'Clients',            icon: 'users', perm: 'clients' },
      { to: '/ventes',       label: 'Ventes',             icon: 'cart',  perm: 'ventes' },
      { to: '/devis',        label: 'Devis',              icon: 'devis', perm: 'devis' },
    ],
  },
  {
    section: 'Caisse',
    items: [
      { to: '/caisse',          label: 'Point de vente',     icon: 'caisse',   perm: 'caisse' },
      { to: '/caisse/sessions', label: 'Sessions de caisse', icon: 'calendar', perm: 'caisse' },
    ],
  },
  {
    section: 'Stock',
    items: [
      { to: '/stock',        label: 'Mouvements stock',   icon: 'warehouse', perm: 'stock' },
      { to: '/lots',         label: 'Lots & péremption',  icon: 'calendar',  perm: 'stock' },
      { to: '/bons-commande',label: 'Bons de commande',   icon: 'bc',        perm: 'commandes' },
      { to: '/retours',      label: 'Retours clients',    icon: 'return',    perm: 'retours' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/creances',     label: 'Créances clients',    icon: 'invoice',  alert: true, perm: 'creances' },
      { to: '/dettes',       label: 'Dettes fournisseurs', icon: 'arrow-up', alert: true, perm: 'dettes' },
      { to: '/echeances',    label: 'Échéances',           icon: 'calendar', perm: 'echeances' },
      { to: '/fournisseurs', label: 'Fournisseurs',        icon: 'building', perm: 'fournisseurs' },
      { to: '/achats',       label: 'Achats fournisseurs', icon: 'import',   perm: 'achats' },
      { to: '/depenses',     label: 'Dépenses',            icon: 'expense',  perm: 'depenses' },
    ],
  },
  {
    section: 'Analyse',
    items: [
      { to: '/rapports',     label: 'Rapports & stats',   icon: 'chart', perm: 'rapports' },
    ],
  },
];

const Icon = ({ name }: { name: string }) => {
  const icons: Record<string, JSX.Element> = {
    grid:      <><rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity=".8"/><rect x="8" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity=".8"/><rect x="1" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity=".8"/><rect x="8" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity=".4"/></>,
    box:       <><rect x="2" y="6" width="10" height="7" rx="1.5" fill="currentColor" opacity=".7"/><path d="M5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2"/></>,
    users:     <><circle cx="6" cy="5" r="2.5" fill="currentColor" opacity=".7"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>,
    cart:      <><path d="M1 2h2l1.5 6h6l1.5-5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/><circle cx="6" cy="11.5" r="1" fill="currentColor" opacity=".8"/><circle cx="10" cy="11.5" r="1" fill="currentColor" opacity=".8"/></>,
    invoice:   <><rect x="2" y="1" width="10" height="12" rx="1.5" fill="currentColor" opacity=".6"/><path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="#fff" strokeWidth="1.1" strokeLinecap="round"/></>,
    'arrow-up':<><path d="M7 2v11M3.5 5.5L7 2l3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/></>,
    calendar:  <><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none"/><path d="M5 1.5v2M9 1.5v2M2 6h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></>,
    building:  <><path d="M2 11V5l4.5-3L11 5v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/><rect x="5" y="7.5" width="4" height="3.5" rx=".8" fill="currentColor" opacity=".6"/></>,
    chart:     <><rect x="1" y="8" width="3" height="5" rx="1" fill="currentColor" opacity=".7"/><rect x="6" y="5" width="3" height="8" rx="1" fill="currentColor" opacity=".7"/><rect x="11" y="2" width="3" height="11" rx="1" fill="currentColor" opacity=".7"/></>,
    store:     <><path d="M1 5l1-3h10l1 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/><rect x="2" y="5" width="10" height="8" rx="1" fill="currentColor" opacity=".5"/><rect x="5" y="9" width="4" height="4" rx=".5" fill="white" opacity=".9"/><path d="M1 5h12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></>,
    import:    <><path d="M7 1v9M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/><path d="M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity=".6"/></>,
    devis:     <><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity=".8"/><path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><path d="M9 10l1.5 1.5L13 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/></>,
    warehouse: <><rect x="1" y="6" width="12" height="7" rx="1" fill="currentColor" opacity=".6"/><path d="M1 7L7 2l6 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/><rect x="5" y="9" width="4" height="4" rx=".5" fill="white" opacity=".8"/></>,
    bc:        <><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity=".7"/><path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".8"/><path d="M10 11l1.5 1.5L14 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></>,
    return:    <><path d="M2 6h9a2 2 0 010 4H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".8"/><path d="M5 8.5L2 6l3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    caisse:    <><rect x="1" y="4" width="12" height="8" rx="1.5" fill="currentColor" opacity=".5"/><path d="M1 6.5h12M4 9.5h.01M7 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><path d="M4 2.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".6"/></>,
    expense:   <><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity=".7"/><path d="M7 4v6M5 5.5h4a1.2 1.2 0 010 2.4H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></>,
    admin:     <><circle cx="7" cy="5" r="2.5" fill="currentColor" opacity=".7"/><path d="M2 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="11" cy="3" r="2" fill="currentColor" opacity=".9"/><path d="M10 3h2M11 2v2" stroke="white" strokeWidth=".8" strokeLinecap="round"/></>,
    menu:      <><path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    close:     <><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
  };
  return (
    <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5 flex-shrink-0">
      {icons[name] ?? null}
    </svg>
  );
};

interface SidebarContentProps {
  user: Utilisateur | null;
  onSearchOpen: () => void;
  onNavClick: () => void;
  magasins: Magasin[];
  magasinActif: number | null;
  peutChoisir: boolean;
  onMagasinChange: (id: number | null) => void;
}

function NavItem({ to, icon, label, onClick }: { to: string; icon: string; label: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/' || to === '/admin'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 mx-2 px-2.5 py-[7px] text-[12.5px] rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-[#1A1917] text-white font-medium shadow-sm'
            : 'text-[#6B6862] hover:bg-[#F2F0EB] hover:text-[#1A1917]'
        }`
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}

function SidebarContent({ user, onSearchOpen, onNavClick, magasins, magasinActif, peutChoisir, onMagasinChange }: SidebarContentProps) {
  const can = useCan();
  // On ne garde que les entrées autorisées ; les sections vides disparaissent.
  const navGroups = NAV
    .map(g => ({ ...g, items: g.items.filter(it => !it.perm || can(it.perm)) }))
    .filter(g => g.items.length > 0);
  return (
    <>
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-black/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1A1917] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4">
              <rect x="5" y="1" width="8" height="16" rx="2" fill="white"/>
              <circle cx="9" cy="14" r="1.2" fill="#1A1917"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#1A1917] leading-tight">StoreBox</div>
            <div className="font-mono text-[9px] text-[#B0ABA5] tracking-widest uppercase">Gestion commerciale</div>
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="px-2 py-2">
        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-[11.5px] text-[#A8A49E] bg-[#F8F7F4] border border-black/[0.07] rounded-lg hover:bg-[#F2F0EB] hover:text-[#6B6862] transition-all duration-150"
        >
          <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5 flex-shrink-0">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span className="flex-1 text-left">Rechercher...</span>
          <span className="font-mono text-[9px] bg-white border border-black/[0.08] px-1.5 py-0.5 rounded-md text-[#C4C0BA]">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pb-2">
        {navGroups.map(group => (
          <div key={group.section} className="mb-1">
            <div className="px-4 pt-3 pb-1.5 font-mono text-[9.5px] text-[#C4C0BA] uppercase tracking-widest">
              {group.section}
            </div>
            {group.items.map(item => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={onNavClick} />
            ))}
          </div>
        ))}

        {/* Admin */}
        {(user && (user.role === 'admin' || user.permissions?.all)) && (
          <div className="mb-1">
            <div className="px-4 pt-3 pb-1.5 font-mono text-[9.5px] text-[#C4C0BA] uppercase tracking-widest">
              Administration
            </div>
            <NavItem to="/magasins"          icon="store"    label="Magasins"                onClick={onNavClick} />
            <NavItem to="/admin"             icon="admin"    label="Utilisateurs"            onClick={onNavClick} />
            <NavItem to="/admin/societe"     icon="building" label="Paramètres société"      onClick={onNavClick} />
            <NavItem to="/admin/referentiels"icon="grid"     label="Tables de référence"     onClick={onNavClick} />
          </div>
        )}
      </nav>

      {/* Sélecteur de magasin */}
      {peutChoisir && magasins.length > 0 && (
        <div className="mx-2 mb-2 p-2.5 bg-[#F8F7F4] border border-black/[0.07] rounded-xl">
          <div className="font-mono text-[9px] text-[#C4C0BA] uppercase tracking-widest mb-1.5">Magasin actif</div>
          <select
            value={magasinActif ?? ''}
            onChange={e => onMagasinChange(e.target.value ? +e.target.value : null)}
            className="w-full text-[11.5px] bg-white border border-black/[0.10] rounded-lg px-2 py-1.5 text-[#1A1917] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 transition-all"
          >
            <option value="">Tous les magasins</option>
            {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
      )}
      {!peutChoisir && user?.magasin_noms?.[0] && (
        <div className="mx-2 mb-2 px-3 py-2 bg-[#F8F7F4] border border-black/[0.07] rounded-xl">
          <div className="font-mono text-[9px] text-[#C4C0BA] uppercase tracking-widest mb-1">Magasin</div>
          <div className="text-[11.5px] font-medium text-[#1A1917] truncate">{user.magasin_noms[0]}</div>
        </div>
      )}

    </>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const { magasinActif, peutChoisir, magasinIds, setMagasin } = useMagasin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [allMagasins, setAllMagasins] = useState<Magasin[]>([]);
  const [societe, setSociete]         = useState<Pick<SocieteParametres, 'nom' | 'logo_url'> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Charger la liste des magasins pour le sélecteur
  useEffect(() => {
    if (peutChoisir) {
      api.get<Magasin[]>('/magasins').then(r => {
        if (r.success && r.data) setAllMagasins(r.data);
      }).catch(() => {});
    }
  }, [peutChoisir]);

  // Charger le nom + logo de la société (une seule fois au montage)
  useEffect(() => {
    api.get<SocieteParametres>('/societe').then(r => {
      if (r.success && r.data) setSociete({ nom: r.data.nom, logo_url: r.data.logo_url });
    }).catch(() => {});
  }, []);

  // Filtrer selon le périmètre de l'utilisateur (admin = tous, multi-magasin = les siens)
  const magasins = magasinIds.length > 0
    ? allMagasins.filter(m => magasinIds.includes(m.id))
    : allMagasins;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavClick = () => setSidebarOpen(false);

  const initiales = ((user?.prenom ?? '')[0] ?? '') + ((user?.nom ?? '')[0] ?? '');

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F4]">

      {/* ── SIDEBAR DESKTOP (md+) ── */}
      <aside className="hidden md:flex w-52 flex-shrink-0 bg-white border-r border-black/[0.08] flex-col">
        <SidebarContent
          user={user}
          onSearchOpen={() => setSearchOpen(true)}
          onNavClick={handleNavClick}
          magasins={magasins}
          magasinActif={magasinActif}
          peutChoisir={peutChoisir}
          onMagasinChange={setMagasin}
        />
      </aside>

      {/* ── SIDEBAR MOBILE (overlay) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 inset-y-0 w-64 bg-white flex flex-col shadow-2xl z-50">
            <SidebarContent
              user={user}
              onSearchOpen={() => setSearchOpen(true)}
              onNavClick={handleNavClick}
              magasins={magasins}
              magasinActif={magasinActif}
              peutChoisir={peutChoisir}
              onMagasinChange={setMagasin}
            />
          </aside>
        </div>
      )}

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOPBAR (mobile + desktop) ── */}
        <div className="flex items-center gap-3 px-4 h-12 bg-white border-b border-black/[0.08] flex-shrink-0">
          {/* Bouton menu — mobile uniquement */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#6B6862] hover:bg-[#F2F0EB] transition-colors flex-shrink-0"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-4 h-4">
              <path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Logo + Nom société */}
          <div className="flex items-center gap-2.5 min-w-0">
            {societe?.logo_url ? (
              <img
                src={societe.logo_url}
                alt="Logo"
                className="w-7 h-7 rounded-lg object-contain flex-shrink-0 border border-black/[0.07] bg-white p-0.5"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#1A1917] flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
                {societe?.nom ? societe.nom.charAt(0).toUpperCase() : (
                  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4">
                    <rect x="5" y="1" width="8" height="16" rx="2" fill="white"/>
                    <circle cx="9" cy="14" r="1.2" fill="#1A1917"/>
                  </svg>
                )}
              </div>
            )}
            <span className="text-[13px] font-semibold text-[#1A1917] truncate">
              {societe?.nom || 'StoreBox'}
            </span>
          </div>

          {/* Menu utilisateur (droite) */}
          <div className="relative ml-auto">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-[#F2F0EB] transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0 shadow-sm">
                {initiales.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[12px] font-medium text-[#1A1917]">{user?.prenom} {user?.nom}</div>
                <div className="font-mono text-[9.5px] text-[#A8A49E]">{user?.roleLabel}</div>
              </div>
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-[#A8A49E] flex-shrink-0">
                <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-black/[0.08] shadow-lg z-50 py-1.5">
                  <div className="px-3 py-2 border-b border-black/[0.06]">
                    <div className="text-[12px] font-medium text-[#1A1917] truncate">{user?.prenom} {user?.nom}</div>
                    <div className="text-[11px] text-[#A8A49E] truncate">{user?.email}</div>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/profil'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[#6B6862] hover:bg-[#F8F7F4] hover:text-[#1A1917] transition-colors"
                  >
                    <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                      <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M2 12.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Mon profil
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5">
                      <path d="M4.5 1H2a1 1 0 00-1 1v8a1 1 0 001 1h2.5M7.5 9l3-3-3-3M10.5 6H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          <Outlet />
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
