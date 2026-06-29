import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { fcfa, fdate, STATUT_BADGE, BADGE_CLASSES } from '../../lib/formatters';
import { Spinner } from './index';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientResult {
  id: number;
  raison_sociale: string;
  telephone: string | null;
  type_client: string;
}

interface ProduitResult {
  id: number;
  designation: string;
  reference: string;
  stock: number;
  prix_gros: number;
}

interface VenteResult {
  id: number;
  numero: string;
  client_nom: string;
  total_ttc: number;
  date_vente: string;
}

interface SearchData {
  clients: ClientResult[];
  produits: ProduitResult[];
  ventes: VenteResult[];
}

// Nombre total de résultats pour le calcul de l'index de navigation
function countResults(data: SearchData | null): number {
  if (!data) return 0;
  return (
    Math.min(data.clients.length, 5) +
    Math.min(data.produits.length, 5) +
    Math.min(data.ventes.length, 5)
  );
}

// Résout (catégorie, index local) depuis un index global
function resolveIndex(
  data: SearchData,
  globalIndex: number
): { type: 'client' | 'produit' | 'vente'; item: ClientResult | ProduitResult | VenteResult } | null {
  const clients  = data.clients.slice(0, 5);
  const produits = data.produits.slice(0, 5);
  const ventes   = data.ventes.slice(0, 5);

  if (globalIndex < clients.length) return { type: 'client', item: clients[globalIndex] };
  const afterClients = globalIndex - clients.length;
  if (afterClients < produits.length) return { type: 'produit', item: produits[afterClients] };
  const afterProduits = afterClients - produits.length;
  if (afterProduits < ventes.length) return { type: 'vente', item: ventes[afterProduits] };
  return null;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery]               = useState('');
  const [data, setData]                 = useState<SearchData | null>(null);
  const [loading, setLoading]           = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Auto-focus quand la palette s'ouvre
  useEffect(() => {
    if (open) {
      setQuery('');
      setData(null);
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fermer sur Escape + navigation clavier
  useEffect(() => {
    if (!open) return;
    const total = countResults(data);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(total, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i <= 0 ? Math.max(total - 1, 0) : i - 1));
      } else if (e.key === 'Enter') {
        if (data && selectedIndex >= 0) {
          const resolved = resolveIndex(data, selectedIndex);
          if (resolved) handleNavigate(resolved.type, resolved.item);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, selectedIndex]);

  // Debounce + appel API
  useEffect(() => {
    if (!open || query.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSelectedIndex(-1);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<SearchData>('/search?q=' + encodeURIComponent(query));
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setData({ clients: [], produits: [], ventes: [] });
        }
      } catch {
        setData({ clients: [], produits: [], ventes: [] });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleNavigate = useCallback(
    (type: 'client' | 'produit' | 'vente', _item: ClientResult | ProduitResult | VenteResult) => {
      const routes: Record<string, string> = {
        client:  '/clients',
        produit: '/produits',
        vente:   '/ventes',
      };
      navigate(routes[type]);
      onClose();
    },
    [navigate, onClose]
  );

  if (!open) return null;

  const clients  = data?.clients.slice(0, 5)  ?? [];
  const produits = data?.produits.slice(0, 5) ?? [];
  const ventes   = data?.ventes.slice(0, 5)   ?? [];
  const hasResults = clients.length + produits.length + ventes.length > 0;
  const noResults  = !loading && query.length >= 2 && data !== null && !hasResults;

  // Offsets d'index global par catégorie
  const produitStartIdx = clients.length;
  const venteStartIdx   = clients.length + produits.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="max-w-xl w-full mx-auto mt-20 sm:mt-32 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Champ de recherche */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.07]">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0 text-[#A8A49E]">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(-1); }}
            placeholder="Rechercher clients, produits, ventes..."
            className="flex-1 text-sm text-[#1A1917] placeholder-[#C3BFB8] bg-transparent outline-none"
          />
          {loading && <Spinner size="sm" />}
          <kbd className="hidden sm:inline-block font-mono text-[10px] text-[#A8A49E] bg-[#F8F7F4] border border-black/[0.08] px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Corps des résultats */}
        <div className="max-h-[420px] overflow-y-auto">
          {/* Hint min 2 chars */}
          {!loading && query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-[#C3BFB8]">
              Tapez au moins 2 caractères...
            </div>
          )}

          {/* Aucun résultat */}
          {noResults && (
            <div className="px-4 py-8 text-center text-sm text-[#C3BFB8]">
              Aucun résultat pour « {query} »
            </div>
          )}

          {/* Clients */}
          {clients.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1 font-mono text-[10px] text-[#A8A49E] uppercase tracking-wider">
                Clients
              </div>
              {clients.map((c) => {
                const idx = clients.indexOf(c);
                const isActive = selectedIndex === idx;
                const badge = STATUT_BADGE[c.type_client];
                return (
                  <button
                    key={c.id}
                    onClick={() => handleNavigate('client', c)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-[11px] font-medium">
                      {c.raison_sociale.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1A1917] truncate">{c.raison_sociale}</div>
                      {c.telephone && (
                        <div className="text-[11px] text-[#A8A49E]">{c.telephone}</div>
                      )}
                    </div>
                    {badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${BADGE_CLASSES[badge.variant]}`}>
                        {badge.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          )}

          {/* Produits */}
          {produits.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1 font-mono text-[10px] text-[#A8A49E] uppercase tracking-wider">
                Produits
              </div>
              {produits.map((p) => {
                const idx = produitStartIdx + produits.indexOf(p);
                const isActive = selectedIndex === idx;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleNavigate('produit', p)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                        <rect x="2" y="6" width="10" height="7" rx="1.5" fill="currentColor" opacity=".7"/>
                        <path d="M5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1A1917] truncate">{p.designation}</div>
                      <div className="text-[11px] text-[#A8A49E]">
                        Réf. {p.reference}
                        <span className="mx-1.5 text-[#D6D1CA]">·</span>
                        Stock : {p.stock}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#6B6862] flex-shrink-0">{fcfa(p.prix_gros)}</span>
                  </button>
                );
              })}
            </section>
          )}

          {/* Ventes */}
          {ventes.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1 font-mono text-[10px] text-[#A8A49E] uppercase tracking-wider">
                Ventes
              </div>
              {ventes.map((v) => {
                const idx = venteStartIdx + ventes.indexOf(v);
                const isActive = selectedIndex === idx;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleNavigate('vente', v)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                        <path d="M1 2h2l1.5 6h6l1.5-5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8"/>
                        <circle cx="6" cy="11.5" r="1" fill="currentColor" opacity=".8"/>
                        <circle cx="10" cy="11.5" r="1" fill="currentColor" opacity=".8"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1A1917] truncate">
                        {v.numero}
                        <span className="ml-1.5 text-[#A8A49E] font-normal text-[11px]">{v.client_nom}</span>
                      </div>
                      <div className="text-[11px] text-[#A8A49E]">{fdate(v.date_vente)}</div>
                    </div>
                    <span className="text-[11px] font-mono text-[#6B6862] flex-shrink-0">{fcfa(v.total_ttc)}</span>
                  </button>
                );
              })}
            </section>
          )}

          {/* Padding bas */}
          {hasResults && <div className="h-2" />}
        </div>
      </div>
    </div>
  );
}
