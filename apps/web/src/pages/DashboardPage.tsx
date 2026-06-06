import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { Skeleton, EmptyState } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { DashboardData } from '@storebox/shared';
import { fcfa, fcfaM } from '../lib/formatters';

const PIE_COLORS  = ['#1B5FD6', '#1A7A4A', '#C47B0A', '#888780'];
const PIE_LABELS  = ['Tél. gros', 'Tél. détail', 'Access. gros', 'Access. détail'];
const PIE_PCT     = [45, 32, 14, 9];

function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Chargement…" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="metric-card space-y-2.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 card p-4 space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-44" />
          </div>
          <div className="card p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            <div className="space-y-2">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-3" />)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <Skeleton className="h-4 w-36" />
          </div>
          {[0,1,2,3,4].map(i => (
            <div key={i} className="px-4 py-3 flex items-center gap-4 border-b border-black/[0.04] last:border-0">
              <Skeleton className="h-3 w-4" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-1.5 w-full" />
              </div>
              <div className="space-y-1 flex flex-col items-end">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { data: d, loading, error, refresh } = useApi<DashboardData>('/dashboard');

  if (loading) return <DashboardSkeleton />;

  if (error || !d) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#6B6862]">
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#C4C0BA]">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 7v6M12 15.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div className="text-sm">{error ?? 'Impossible de charger le tableau de bord.'}</div>
      <button onClick={refresh} className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2">
        Réessayer
      </button>
    </div>
  );

  const creancesRetard = Number(d.creances?.en_retard ?? 0);
  const dettesUrgent   = Number(d.dettes?.urgent ?? 0);

  const kpis = [
    {
      label: 'CA DU MOIS',
      value: fcfaM(d.ca?.ca_mois),
      sub: `${d.ca?.nb_ventes ?? '—'} ventes`,
      accent: 'metric-card-blue',
      subColor: 'text-brand-500',
    },
    {
      label: 'CRÉANCES CLIENTS',
      value: fcfaM(d.creances?.total),
      sub: creancesRetard > 0 ? `↑ ${fcfaM(creancesRetard)} en retard` : '✓ Sain',
      accent: creancesRetard > 0 ? 'metric-card-red' : 'metric-card-green',
      subColor: creancesRetard > 0 ? 'text-red-600' : 'text-emerald-600',
    },
    {
      label: 'DETTES FOURNISSEURS',
      value: fcfaM(d.dettes?.total),
      sub: dettesUrgent > 0 ? `↑ ${fcfaM(dettesUrgent)} urgent` : '✓ OK',
      accent: dettesUrgent > 0 ? 'metric-card-amber' : 'metric-card-green',
      subColor: dettesUrgent > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      label: 'TRÉSORERIE NETTE',
      value: fcfaM(d.tresorerie?.net),
      sub: 'Entrées − sorties mois',
      accent: Number(d.tresorerie?.net ?? 0) >= 0 ? 'metric-card-green' : 'metric-card-red',
      subColor: 'text-[#6B6862]',
    },
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} · StoreBox`}
      />

      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">

        {/* Alerte créances */}
        {creancesRetard > 0 && (
          <div className="flex items-center gap-3 bg-red-50 text-red-800 border border-red-200 rounded-xl px-4 py-3 text-xs">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-red-600">
                <path d="M6 2v5M6 8.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <span>
              <span className="font-semibold">Créances en retard :</span>{' '}
              {fcfa(creancesRetard)} à recouvrer d'urgence
            </span>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {kpis.map(({ label, value, sub, accent, subColor }) => (
            <div key={label} className={`metric-card ${accent}`}>
              <div className="font-mono text-[10px] text-[#A8A49E] mb-2 uppercase tracking-wide">{label}</div>
              <div className="text-[20px] sm:text-[23px] font-light text-[#1A1917] leading-none tabular-nums">{value}</div>
              <div className={`text-[11px] mt-2 font-medium ${subColor}`}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* CA 6 mois */}
          <div className="sm:col-span-2 card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-semibold text-[#1A1917]">Chiffre d'affaires — 6 mois</div>
              <div className="flex gap-3 text-[11px] text-[#6B6862]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-brand-500 rounded-sm" />Gros
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-600 rounded-sm" />Détail
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={d.caChart ?? []} barSize={14} barGap={2}>
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false} tickFormatter={v => (v/1e6).toFixed(0)+'M'} />
                <Tooltip
                  formatter={(v: number) => fcfa(v)}
                  labelStyle={{ fontSize: 11, color: '#1A1917', fontWeight: 600 }}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="gros"   fill="#1B5FD6" radius={[3,3,0,0]} />
                <Bar dataKey="detail" fill="#1A7A4A" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Répartition */}
          <div className="card p-4">
            <div className="text-[13px] font-semibold text-[#1A1917] mb-4">Répartition produits</div>
            <div className="space-y-2.5">
              {PIE_LABELS.map((l, i) => (
                <div key={l}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#6B6862]">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      {l}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-[#1A1917]">{PIE_PCT[i]}%</span>
                  </div>
                  <div className="h-1.5 bg-black/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${PIE_PCT[i]}%`, background: PIE_COLORS[i] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top produits */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
            <div className="text-[13px] font-semibold text-[#1A1917]">Top ventes du mois</div>
            {d.topProduits?.length > 0 && (
              <div className="font-mono text-[10px] text-[#A8A49E]">{d.topProduits.length} produits</div>
            )}
          </div>
          {(!d.topProduits || d.topProduits.length === 0) ? (
            <EmptyState message="Aucune vente ce mois-ci" />
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {d.topProduits.map((p, i) => {
                const max = Number(d.topProduits[0]?.ca_genere ?? 1);
                const pct = (Number(p.ca_genere) / max) * 100;
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-4 hover:bg-[#FAFAF8] transition-colors">
                    <div className="font-mono text-[11px] text-[#C4C0BA] w-4 text-center flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#1A1917] truncate">{p.designation}</div>
                      <div className="h-1.5 bg-black/[0.05] rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] font-semibold text-[#1A1917] tabular-nums">{fcfa(Number(p.ca_genere))}</div>
                      <div className="font-mono text-[10px] text-[#A8A49E]">{p.qte_vendue} u.</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
