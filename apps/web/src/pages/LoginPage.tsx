import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../hooks/useAuth';

const DEMO_ACCOUNTS = [
  { email: 'admin@storebox.app',      role: 'Administrateur', initiale: 'A', color: 'bg-violet-500' },
  { email: 'commercial@storebox.app', role: 'Commercial',     initiale: 'C', color: 'bg-blue-500'   },
  { email: 'caisse@storebox.app',     role: 'Caissier',       initiale: 'C', color: 'bg-emerald-500'},
  { email: 'compta@storebox.app',     role: 'Comptable',      initiale: 'C', color: 'bg-orange-500' },
];

const STATS = [
  { val: '500+',  label: 'Produits gérés'     },
  { val: '99.9%', label: 'Disponibilité'       },
  { val: 'FCFA',  label: 'Devise native CI'    },
  { val: 'SMS',   label: 'Alertes en temps réel'},
];

function PhoneIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
      <rect x="7" y="1" width="18" height="30" rx="4" fill="white" fillOpacity=".15"/>
      <rect x="7" y="1" width="18" height="30" rx="4" stroke="white" strokeWidth="1.5"/>
      <circle cx="16" cy="26" r="2" fill="white" fillOpacity=".6"/>
      <rect x="13" y="4.5" width="6" height="1.5" rx=".75" fill="white" fillOpacity=".4"/>
      <rect x="10" y="9"  width="12" height="1"   rx=".5"  fill="white" fillOpacity=".25"/>
      <rect x="10" y="12" width="9"  height="1"   rx=".5"  fill="white" fillOpacity=".2"/>
      <rect x="10" y="15" width="11" height="1"   rx=".5"  fill="white" fillOpacity=".2"/>
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
      <path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.5 4.7C2.8 5.8 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.6-1M6.7 3.1C7.1 3 7.5 3 8 3c4.5 0 7 5 7 5s-.7 1.4-2 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export default function LoginPage() {
  const { login, loading, error, user } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login({ email, password });
    if (ok) navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche – branding ───────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F3460 100%)' }}>

        {/* Cercles décoratifs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #60A5FA, transparent)' }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #818CF8, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-5"
             style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <PhoneIcon />
          </div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">StoreBox</div>
            <div className="text-blue-300 text-[10px] font-mono tracking-widest uppercase">Gestion commerciale</div>
          </div>
        </div>

        {/* Contenu central */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-medium text-blue-300"
               style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Plateforme opérationnelle · Abidjan
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gérez votre commerce<br />
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #60A5FA, #818CF8)' }}>
              en toute simplicité
            </span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Ventes, stocks, créances, dettes et rapports — tout ce dont votre boutique de téléphones a besoin.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            {STATS.map(s => (
              <div key={s.label}
                   className="rounded-xl p-4"
                   style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-2xl font-bold text-white mb-0.5">{s.val}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer gauche */}
        <div className="relative z-10 text-slate-600 text-xs font-mono">
          v2.0 · © 2026 StoreBox
        </div>
      </div>

      {/* ── Panneau droit – formulaire ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 lg:p-12">

        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <rect x="5" y="1" width="14" height="22" rx="3" fill="white"/>
              <circle cx="12" cy="19.5" r="1.5" fill="#1A1917"/>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900">StoreBox</div>
            <div className="text-[10px] text-slate-400 font-mono tracking-widest">GESTION COMMERCIALE</div>
          </div>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Titre */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Bon retour 👋</h2>
            <p className="text-slate-500 text-sm">Connectez-vous à votre espace de gestion.</p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0 mt-0.5">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 4.5v4M8 10.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Adresse email
              </label>
              <div className={`relative transition-all duration-150 ${focused === 'email' ? 'ring-2 ring-blue-500 ring-offset-0 rounded-xl' : ''}`}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="votre@email.ci"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors hover:border-slate-300 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Mot de passe
                </label>
              </div>
              <div className={`relative transition-all duration-150 ${focused === 'password' ? 'ring-2 ring-blue-500 ring-offset-0 rounded-xl' : ''}`}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                    <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors hover:border-slate-300 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading
                  ? '#1E40AF'
                  : 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          {/* Comptes démo */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">Comptes de démonstration</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword('Storebox@123'); }}
                  className="group flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-150 text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${a.color}`}>
                    {a.initiale}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 truncate leading-tight">
                      {a.email.split('@')[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{a.role}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2 font-mono">
              Mot de passe : Storebox@123
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
