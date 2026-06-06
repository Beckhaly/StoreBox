import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { fcfa, fcfaM } from '../lib/formatters';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ─── Types ────────────────────────────────────────────────── */

interface RapportData {
  caGlobal: Array<{ m: string; ca: number }>;
  topClients: Array<{ raison_sociale: string; ca: number }>;
  dso: { dso: number };
  kpi: { ca_mois: number; marge_brute: number };
}

interface StockData {
  valorisation: {
    val_achat: number;
    val_gros: number;
    val_detail: number;
    references: number;
    unites: number;
  };
  parCategorie: Array<{ categorie: string; nb_refs: number; stock_total: number; valeur: number }>;
  dormants: Array<{ id: number; reference: string; designation: string; marque: string; stock: number; valeur: number }>;
  rotation: Array<{ id: number; reference: string; designation: string; qte_vendue_30j: number; stock: number }>;
}

interface RentabiliteData {
  produits: Array<{
    designation: string;
    reference: string;
    ca_total: number;
    cout_total: number;
    marge_brute: number;
    taux_marge: number;
    qte_vendue: number;
  }>;
  global: { ca_total: number; marge_totale: number; taux_marge_global: number };
}

interface TresorerieData {
  actuel: { entrees: number; sorties: number };
  previsions: Array<{ semaine: string; encaissements_prevus: number; decaissements_prevus: number }>;
  historique: Array<{ mois: string; entrees: number; sorties: number }>;
}

interface ClientsData {
  clients: Array<{ id: number; raison_sociale: string; ca_total: number; creances: number; dso: number; statut: string }>;
  ageing: { non_echu: number; echu_30: number; echu_60: number; contentieux: number };
  debiteurs: Array<{ raison_sociale: string; creances: number; jours_retard: number }>;
}

interface FournisseursData {
  fournisseurs: Array<{ id: number; raison_sociale: string; dettes: number; delai_moyen: number; statut: string }>;
  dettes_urgentes: Array<{ raison_sociale: string; dettes: number; jours_echéance: number }>;
}

interface VendeursData {
  vendeurs: Array<{ id: number; nom: string; ca_total: number; nb_ventes: number; ticket_moyen: number; marge: number }>;
  performance: Array<{ mois: string; ca: number }>;
  cumul: { ca_total: number; nb_ventes: number };
}

interface RetoursData {
  retours: Array<{ id: number; reference: string; designation: string; qte: number; raison: string; date: string }>;
  par_raison: Array<{ raison: string; nb: number; total: number }>;
  par_client: Array<{ raison_sociale: string; nb_retours: number; total: number }>;
}

interface CommandesData {
  en_cours: Array<{ num_bl: string; client: string; date: string; total: number; statut: string }>;
  devis: Array<{ num_devis: string; client: string; montant: number; date_creation: string }>;
  stats: { nb_en_cours: number; total_en_cours: number; nb_devis: number };
}

interface ComparaisonData {
  mois_courant: { ca: number; marge: number; nb_ventes: number };
  mois_precedent: { ca: number; marge: number; nb_ventes: number };
  meme_mois_année_derniere: { ca: number };
  tendance: Array<{ mois: string; ca_an: number; ca_ln: number }>;
}

interface MargeProduitData {
  par_categorie: Array<{ categorie: string; ca: number; marge: number; taux: number }>;
  par_fournisseur: Array<{ fournisseur: string; ca: number; marge: number; taux: number }>;
  tendance_marge: Array<{ mois: string; taux: number }>;
}

interface PrevisionsData {
  tendance_6m: Array<{ mois: string; ca_actuel: number; ca_previsionnel: number }>;
  saisonnalite: Array<{ mois: string; ca_moyen: number; coefficient: number }>;
  objectifs: { ca_annee: number; ca_cumul: number; taux_realisation: number };
}

type Tab = 'ventes' | 'stock' | 'rentabilite' | 'tresorerie' | 'clients' | 'fournisseurs' | 'vendeurs' | 'retours' | 'commandes' | 'comparaison' | 'marge_produit' | 'previsions';

/* ─── Tab Bar ───────────────────────────────────────────────── */

const TABS: { id: Tab; label: string }[] = [
  { id: 'ventes',          label: 'Ventes' },
  { id: 'stock',           label: 'Stock' },
  { id: 'rentabilite',     label: 'Rentabilité' },
  { id: 'tresorerie',      label: 'Trésorerie' },
  { id: 'clients',         label: 'Clients' },
  { id: 'fournisseurs',    label: 'Fournisseurs' },
  { id: 'vendeurs',        label: 'Vendeurs' },
  { id: 'retours',         label: 'Retours' },
  { id: 'commandes',       label: 'Commandes' },
  { id: 'comparaison',     label: 'Comparaison' },
  { id: 'marge_produit',   label: 'Marges/catégorie' },
  { id: 'previsions',      label: 'Prévisions' },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-black/[0.08] mb-4">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            active === t.id
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-[#6B6862] hover:text-[#1A1917]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Tab: Ventes ───────────────────────────────────────────── */

function TabVentes() {
  const { data, loading } = useApi<RapportData>('/rapports/performance');

  const kpis = data ? [
    {
      label: 'CA MENSUEL',
      value: fcfaM(data.kpi.ca_mois),
      ref: 'Obj. 20 M F',
      ok: data.kpi.ca_mois > 20_000_000,
    },
    {
      label: 'MARGE BRUTE',
      value: data.kpi.ca_mois > 0
        ? (data.kpi.marge_brute / data.kpi.ca_mois * 100).toFixed(1) + '%'
        : '—',
      ref: '> 20% cible',
      ok: (data.kpi.marge_brute / (data.kpi.ca_mois || 1) * 100) > 20,
    },
    {
      label: 'DSO CLIENTS',
      value: `${data.dso?.dso ?? '—'} j`,
      ref: '≤ 30j cible',
      ok: (data.dso?.dso ?? 99) <= 30,
    },
  ] : [];

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {kpis.map(({ label, value, ref, ok }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
            <div className={`text-[11px] mt-1.5 flex items-center gap-1 ${ok ? 'text-green-700' : 'text-amber-600'}`}>
              <span>{ok ? '✓' : '△'}</span> {ref}
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CA 6 mois */}
        <div className="lg:col-span-2 card p-4">
          <div className="text-[13px] font-medium mb-3">CA mensuel — 6 mois</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.caGlobal ?? []} barSize={18}>
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
                tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
              <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="ca" fill="#1B5FD6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top clients */}
        <div className="card p-4">
          <div className="text-[13px] font-medium mb-3">Top 5 clients</div>
          <div className="space-y-2">
            {(data?.topClients ?? []).slice(0, 5).map((c, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-black/[0.05] last:border-0">
                <span className="truncate max-w-[140px] text-[#1A1917]">{c.raison_sociale}</span>
                <span className="font-mono font-medium ml-2 flex-shrink-0">{fcfaM(+c.ca)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Stock ────────────────────────────────────────────── */

function TabStock() {
  const { data, loading } = useApi<StockData>('/rapports/avances/stock');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const v = data?.valorisation;

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'VALEUR ACHAT',   value: fcfaM(v?.val_achat)   },
          { label: 'VALEUR GROS',    value: fcfaM(v?.val_gros)    },
          { label: 'RÉFÉRENCES',     value: String(v?.references ?? '—') },
          { label: 'UNITÉS EN STOCK', value: String(v?.unites ?? '—') },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Valeur par catégorie */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Valeur par catégorie</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.parCategorie ?? []} barSize={20}>
            <XAxis dataKey="categorie" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="valeur" fill="#1B5FD6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Produits dormants */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
            Produits dormants (90+ jours)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                  <th className="px-4 py-2 text-left font-medium">Désignation</th>
                  <th className="px-4 py-2 text-left font-medium">Marque</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(data?.dormants ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2 truncate max-w-[160px]">{p.designation}</td>
                    <td className="px-4 py-2 text-[#6B6862]">{p.marque}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.stock}</td>
                    <td className="px-4 py-2 text-right font-mono">{fcfaM(p.valeur)}</td>
                  </tr>
                ))}
                {(data?.dormants ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[#A8A49E]">Aucun produit dormant</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rotation 30 jours */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
            Rotation 30 jours
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                  <th className="px-4 py-2 text-left font-medium">Désignation</th>
                  <th className="px-4 py-2 text-right font-medium">Vendus 30j</th>
                  <th className="px-4 py-2 text-right font-medium">Stock actuel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(data?.rotation ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2 truncate max-w-[200px]">{p.designation}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.qte_vendue_30j}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.stock}</td>
                  </tr>
                ))}
                {(data?.rotation ?? []).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-[#A8A49E]">Aucune donnée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Rentabilité ──────────────────────────────────────── */

function TabRentabilite() {
  const { data, loading } = useApi<RentabiliteData>('/rapports/avances/rentabilite');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const g = data?.global;
  const top10 = (data?.produits ?? [])
    .slice()
    .sort((a, b) => Number(b.marge_brute) - Number(a.marge_brute))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'CA TOTAL',       value: fcfaM(g?.ca_total)     },
          { label: 'MARGE TOTALE',   value: fcfaM(g?.marge_totale) },
          { label: 'TAUX MARGE GLOBAL', value: g ? Number(g.taux_marge_global).toFixed(1) + '%' : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Top 10 marges */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Top 10 marges</div>
        <div className="flex gap-3 mb-2 text-[11px] text-[#6B6862]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1B5FD6] rounded-sm inline-block" />Marge brute
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1A7A4A] rounded-sm inline-block" />CA total
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={top10} barSize={10}>
            <XAxis dataKey="designation" tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="marge_brute" fill="#1B5FD6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ca_total"   fill="#1A7A4A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table complète */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Détail par produit
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Désignation</th>
                <th className="px-4 py-2 text-left font-medium">Référence</th>
                <th className="px-4 py-2 text-right font-medium">CA</th>
                <th className="px-4 py-2 text-right font-medium">Coût</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
                <th className="px-4 py-2 text-right font-medium">Taux%</th>
                <th className="px-4 py-2 text-right font-medium">Qté</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.produits ?? []).map((p, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px]">{p.designation}</td>
                  <td className="px-4 py-2 font-mono text-[#6B6862]">{p.reference}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(p.ca_total)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(p.cout_total)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(p.marge_brute)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${Number(p.taux_marge) >= 20 ? 'text-green-700' : 'text-amber-600'}`}>
                    {Number(p.taux_marge).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{p.qte_vendue}</td>
                </tr>
              ))}
              {(data?.produits ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[#A8A49E]">Aucune donnée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Trésorerie ───────────────────────────────────────── */

function TabTresorerie() {
  const { data, loading } = useApi<TresorerieData>('/rapports/avances/tresorerie');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const net = data ? Number(data.actuel.entrees) - Number(data.actuel.sorties) : 0;

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">ENTRÉES DU MOIS</div>
          <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{fcfaM(data?.actuel.entrees)}</div>
        </div>
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">SORTIES DU MOIS</div>
          <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{fcfaM(data?.actuel.sorties)}</div>
        </div>
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">NET DU MOIS</div>
          <div className={`text-lg sm:text-[22px] font-light ${net < 0 ? 'text-red-600' : 'text-[#1A1917]'}`}>
            {fcfaM(net)}
          </div>
        </div>
      </div>

      {/* Historique 6 mois */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Historique 6 mois</div>
        <div className="flex gap-3 mb-2 text-[11px] text-[#6B6862]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1A7A4A] rounded-sm inline-block" />Entrées
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#D93025] rounded-sm inline-block" />Sorties
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data?.historique ?? []}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="entrees" stroke="#1A7A4A" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sorties" stroke="#D93025" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Prévisions */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Prévisions encaissements / décaissements</div>
        <div className="flex gap-3 mb-2 text-[11px] text-[#6B6862]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1B5FD6] rounded-sm inline-block" />Encaissements prévus
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#C47B0A] rounded-sm inline-block" />Décaissements prévus
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={(data?.previsions ?? []).slice(0, 4)} barSize={16}>
            <XAxis dataKey="semaine" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="encaissements_prevus"  fill="#1B5FD6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="decaissements_prevus"  fill="#C47B0A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Tab: Clients ──────────────────────────────────────────── */

function TabClients() {
  const { data, loading } = useApi<ClientsData>('/rapports/clients');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const a = data?.ageing;
  const tot = (a?.non_echu ?? 0) + (a?.echu_30 ?? 0) + (a?.echu_60 ?? 0) + (a?.contentieux ?? 0);

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'NON ÉCHU',      value: fcfaM(a?.non_echu)     },
          { label: 'ÉCHU 30 JOURS', value: fcfaM(a?.echu_30)      },
          { label: 'ÉCHU 60+ JOURS', value: fcfaM(a?.echu_60)     },
          { label: 'CONTENTIEUX',   value: fcfaM(a?.contentieux)  },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Ageing des créances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-[13px] font-medium mb-3">Répartition de l'ageing</div>
          {tot === 0 ? (
            <div className="py-10 text-center text-[#A8A49E]">Pas de créances</div>
          ) : (
            <>
              {[
                { label: 'Non échu', val: a?.non_echu ?? 0, color: '#1A7A4A' },
                { label: 'Échu 30j', val: a?.echu_30 ?? 0, color: '#C47B0A' },
                { label: 'Échu 60j+', val: a?.echu_60 ?? 0, color: '#D93025' },
                { label: 'Contentieux', val: a?.contentieux ?? 0, color: '#6B6862' },
              ].map(({ label, val, color }) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#6B6862]">{label}</span>
                    <span className="font-medium">{((val / tot) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${(val / tot) * 100}%`, background: color }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Clients à relancer */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
            Débiteurs à relancer
          </div>
          <div className="divide-y divide-black/[0.05]">
            {(data?.debiteurs ?? []).slice(0, 8).map((c, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{c.raison_sociale}</div>
                  <div className="text-[10px] text-[#A8A49E]">{c.jours_retard} jours</div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xs font-mono">{fcfaM(c.creances)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Liste clients */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Tous les clients
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-right font-medium">CA total</th>
                <th className="px-4 py-2 text-right font-medium">Créances</th>
                <th className="px-4 py-2 text-right font-medium">DSO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.clients ?? []).map((c, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px] text-[#1A1917]">{c.raison_sociale}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(c.ca_total)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(c.creances)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[#6B6862]">{c.dso} j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Fournisseurs ─────────────────────────────────────── */

function TabFournisseurs() {
  const { data, loading } = useApi<FournisseursData>('/rapports/fournisseurs');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const total_dettes = (data?.fournisseurs ?? []).reduce((s, f) => s + Number(f.dettes), 0);

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {[
          { label: 'DETTES FOURNISSEURS', value: fcfaM(total_dettes) },
          { label: 'DETTES URGENTES',    value: fcfaM((data?.dettes_urgentes ?? []).reduce((s, d) => s + Number(d.dettes), 0)) },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Dettes urgentes */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Dettes urgentes (&lt; 7j)
        </div>
        <div className="divide-y divide-black/[0.05]">
          {(data?.dettes_urgentes ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-[#A8A49E]">✓ Aucune dette urgente</div>
          ) : (
            (data?.dettes_urgentes ?? []).map((d, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">{d.raison_sociale}</div>
                  <div className="text-[10px] text-[#A8A49E]">Échéance : {d.jours_echéance} j</div>
                </div>
                <div className="text-right font-mono text-xs">{fcfaM(d.dettes)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tous les fournisseurs */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Tous les fournisseurs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Fournisseur</th>
                <th className="px-4 py-2 text-right font-medium">Dettes</th>
                <th className="px-4 py-2 text-right font-medium">Délai moyen</th>
                <th className="px-4 py-2 text-center font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.fournisseurs ?? []).map((f, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px]">{f.raison_sociale}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(f.dettes)}</td>
                  <td className="px-4 py-2 text-right font-mono">{f.delai_moyen} j</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded-full ${f.statut === 'OK' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {f.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Vendeurs ────────────────────────────────────────── */

function TabVendeurs() {
  const { data, loading } = useApi<VendeursData>('/rapports/vendeurs');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const vendeurs_sorted = (data?.vendeurs ?? [])
    .slice()
    .sort((a, b) => Number(b.ca_total) - Number(a.ca_total));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'CA TOTAL',        value: fcfaM(data?.cumul.ca_total)     },
          { label: 'NB VENTES',       value: String(data?.cumul.nb_ventes ?? '—') },
          { label: 'TICKET MOYEN',    value: data?.cumul.nb_ventes ? fcfaM(Number(data.cumul.ca_total) / Number(data.cumul.nb_ventes)) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Performance tendance */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Tendance CA par vendeur (6 mois)</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data?.performance ?? []}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="ca" stroke="#1B5FD6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau vendeurs */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Détail par vendeur
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Vendeur</th>
                <th className="px-4 py-2 text-right font-medium">CA total</th>
                <th className="px-4 py-2 text-right font-medium">Nb ventes</th>
                <th className="px-4 py-2 text-right font-medium">Ticket moy</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {vendeurs_sorted.map((v, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[160px]">{v.nom}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(v.ca_total)}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.nb_ventes}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(Number(v.ca_total) / v.nb_ventes)}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(v.marge).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Retours ──────────────────────────────────────────── */

function TabRetours() {
  const { data, loading } = useApi<RetoursData>('/rapports/retours');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const nb_retours_total = (data?.retours ?? []).length;
  const total_montant = (data?.par_raison ?? []).reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {[
          { label: 'RETOURS (mois)',     value: String(nb_retours_total ?? '—') },
          { label: 'MONTANT RETOURS',    value: fcfaM(total_montant) },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Retours par raison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-[13px] font-medium mb-3">Raisons de retour</div>
          <div className="space-y-2">
            {(data?.par_raison ?? []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-black/[0.05] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.raison}</div>
                  <div className="text-[10px] text-[#A8A49E]">{r.nb} retours</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-mono">{fcfaM(r.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retours par client */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
            Clients problématiques
          </div>
          <div className="divide-y divide-black/[0.05]">
            {(data?.par_client ?? []).slice(0, 8).map((c, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{c.raison_sociale}</div>
                  <div className="text-[10px] text-[#A8A49E]">{c.nb_retours} retours</div>
                </div>
                <div className="text-xs font-mono ml-2 flex-shrink-0">{fcfaM(c.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tous les retours */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Tous les retours
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Produit</th>
                <th className="px-4 py-2 text-left font-medium">Raison</th>
                <th className="px-4 py-2 text-right font-medium">Qté</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.retours ?? []).map((r, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[150px]">{r.designation}</td>
                  <td className="px-4 py-2 text-[#6B6862]">{r.raison}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.qte}</td>
                  <td className="px-4 py-2 text-[#A8A49E]">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Commandes ────────────────────────────────────────── */

function TabCommandes() {
  const { data, loading } = useApi<CommandesData>('/rapports/commandes');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'BL EN COURS',    value: String(data?.stats.nb_en_cours ?? '—') },
          { label: 'TOTAL EN COURS', value: fcfaM(data?.stats.total_en_cours) },
          { label: 'DEVIS ATTENTE',  value: String(data?.stats.nb_devis ?? '—') },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* BL en cours */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          BL en cours
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">N° BL</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
                <th className="px-4 py-2 text-center font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.en_cours ?? []).map((b, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 font-mono font-medium">{b.num_bl}</td>
                  <td className="px-4 py-2 truncate max-w-[150px]">{b.client}</td>
                  <td className="px-4 py-2 text-[#6B6862]">{new Date(b.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(b.total)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                      {b.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Devis en attente */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.08] text-[13px] font-medium">
          Devis en attente de signature
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">N° Devis</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-left font-medium">Date création</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.devis ?? []).map((d, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 font-mono font-medium">{d.num_devis}</td>
                  <td className="px-4 py-2 truncate max-w-[150px]">{d.client}</td>
                  <td className="px-4 py-2 text-[#6B6862]">{new Date(d.date_creation).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(d.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Comparaison ──────────────────────────────────────── */

function TabComparaison() {
  const { data, loading } = useApi<ComparaisonData>('/rapports/comparaison');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const var_ca = data ? ((data.mois_courant.ca - data.mois_precedent.ca) / data.mois_precedent.ca * 100) : 0;
  const var_ca_yn = data ? ((data.mois_courant.ca - data.meme_mois_année_derniere.ca) / data.meme_mois_année_derniere.ca * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Comparaison MoM */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">CA MOIS COURANT</div>
          <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{fcfaM(data?.mois_courant.ca)}</div>
          <div className={`text-[11px] mt-1.5 flex items-center gap-1 ${var_ca >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {var_ca >= 0 ? '↑' : '↓'} {Math.abs(var_ca).toFixed(1)}% vs mois dernier
          </div>
        </div>
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">MARGE % DU MOIS</div>
          <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">
            {data ? Number(data.mois_courant.marge).toFixed(1) + '%' : '—'}
          </div>
          <div className={`text-[11px] mt-1.5 flex items-center gap-1 ${(data?.mois_courant.marge ?? 0) > 20 ? 'text-green-700' : 'text-amber-600'}`}>
            {(data?.mois_courant.marge ?? 0) > 20 ? '✓' : '△'} Cible 20%
          </div>
        </div>
        <div className="metric-card">
          <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">VS MÊME MOIS (N-1)</div>
          <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">
            {var_ca_yn.toFixed(1)}%
          </div>
          <div className={`text-[11px] mt-1.5 flex items-center gap-1 ${var_ca_yn >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {var_ca_yn >= 0 ? '↑' : '↓'} Tendance annuelle
          </div>
        </div>
      </div>

      {/* Graphique tendance */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Tendance 12 mois (année N vs N-1)</div>
        <div className="flex gap-3 mb-2 text-[11px] text-[#6B6862]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1B5FD6] rounded-sm inline-block" />Année N
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#C47B0A] rounded-sm inline-block" />Année N-1
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.tendance ?? []}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="ca_an" stroke="#1B5FD6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ca_ln" stroke="#C47B0A" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Tab: Marges/Catégorie ────────────────────────────────── */

function TabMargeProduit() {
  const { data, loading } = useApi<MargeProduitData>('/rapports/marges');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* Marges par catégorie */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Marges par catégorie</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Catégorie</th>
                <th className="px-4 py-2 text-right font-medium">CA</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
                <th className="px-4 py-2 text-right font-medium">Taux %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.par_categorie ?? []).map((c, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px] font-medium">{c.categorie}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(c.ca)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(c.marge)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${Number(c.taux) >= 20 ? 'text-green-700' : 'text-amber-600'}`}>
                    {Number(c.taux).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Marges par fournisseur */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Marges par fournisseur</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#A8A49E]">
                <th className="px-4 py-2 text-left font-medium">Fournisseur</th>
                <th className="px-4 py-2 text-right font-medium">CA</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
                <th className="px-4 py-2 text-right font-medium">Taux %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {(data?.par_fournisseur ?? []).map((f, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px]">{f.fournisseur}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(f.ca)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fcfaM(f.marge)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${Number(f.taux) >= 20 ? 'text-green-700' : 'text-amber-600'}`}>
                    {Number(f.taux).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tendance marge */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Tendance du taux de marge (6 mois)</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data?.tendance_marge ?? []}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => v.toFixed(0) + '%'} />
            <Tooltip formatter={(v: number) => v.toFixed(1) + '%'} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="taux" stroke="#1B5FD6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Tab: Prévisions ───────────────────────────────────────── */

function TabPrevisions() {
  const { data, loading } = useApi<PrevisionsData>('/rapports/previsions');

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const obj = data?.objectifs;

  return (
    <div className="space-y-4">
      {/* Objectifs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'OBJECTIF ANNUEL',    value: fcfaM(obj?.ca_annee)         },
          { label: 'RÉALISÉ À CE JOUR',  value: fcfaM(obj?.ca_cumul)         },
          { label: 'TAUX RÉALISATION',   value: obj ? Number(obj.taux_realisation).toFixed(1) + '%' : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card">
            <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
            <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
          </div>
        ))}
      </div>

      {/* Tendance */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Projection 6 mois (réel vs prévisionnel)</div>
        <div className="flex gap-3 mb-2 text-[11px] text-[#6B6862]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1A7A4A] rounded-sm inline-block" />Réel
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#1B5FD6] rounded-sm inline-block" />Prévisionnel
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.tendance_6m ?? []} barSize={18}>
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
              tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
            <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="ca_actuel"       fill="#1A7A4A" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ca_previsionnel" fill="#1B5FD6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Saisonnalité */}
      <div className="card p-4">
        <div className="text-[13px] font-medium mb-3">Saisonnalité par mois</div>
        <div className="space-y-2">
          {(data?.saisonnalite ?? []).map((s, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B6862]">{s.mois}</span>
                <span className="font-medium">{Number(s.coefficient).toFixed(2)}x</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(Number(s.coefficient) * 50, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ───────────────────────────────────────── */

export default function RapportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ventes');

  return (
    <>
      <PageHeader title="Rapports & statistiques" subtitle="Performance commerciale" />
      <div className="p-4 sm:p-6">
        <TabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === 'ventes'          && <TabVentes />}
        {activeTab === 'stock'           && <TabStock />}
        {activeTab === 'rentabilite'     && <TabRentabilite />}
        {activeTab === 'tresorerie'      && <TabTresorerie />}
        {activeTab === 'clients'         && <TabClients />}
        {activeTab === 'fournisseurs'    && <TabFournisseurs />}
        {activeTab === 'vendeurs'        && <TabVendeurs />}
        {activeTab === 'retours'         && <TabRetours />}
        {activeTab === 'commandes'       && <TabCommandes />}
        {activeTab === 'comparaison'     && <TabComparaison />}
        {activeTab === 'marge_produit'   && <TabMargeProduit />}
        {activeTab === 'previsions'      && <TabPrevisions />}
      </div>
    </>
  );
}
