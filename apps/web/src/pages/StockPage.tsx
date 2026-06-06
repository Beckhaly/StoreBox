import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { useMagasin } from '../hooks/useMagasin';
import { Produit, MouvementStock, TypeMouvement, StockMagasin, Magasin } from '@storebox/shared';
import { fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface Valorisation {
  val_achat:  number;
  val_gros:   number;
  val_detail: number;
  references: number;
  unites:     number;
}

type FiltreTab = 'tous' | TypeMouvement;

const TABS: { key: FiltreTab; label: string }[] = [
  { key: 'tous',        label: 'Tous' },
  { key: 'entree',      label: 'Entrées' },
  { key: 'sortie',      label: 'Sorties' },
  { key: 'ajustement',  label: 'Ajustements' },
  { key: 'retour',      label: 'Retours' },
];

const TYPE_BADGE: Record<TypeMouvement, { cls: string; label: string }> = {
  entree:     { cls: 'bg-green-50 text-green-700',  label: 'Entrée' },
  sortie:     { cls: 'bg-red-50 text-red-700',      label: 'Sortie' },
  ajustement: { cls: 'bg-blue-50 text-blue-700',    label: 'Ajustement' },
  retour:     { cls: 'bg-amber-50 text-amber-700',  label: 'Retour' },
};

const VIDE_AJUST = { produit_id: '', quantite: '', motif: '' };
const VIDE_TRF   = { produit_id: '', magasin_source: '', magasin_dest: '', quantite: '', notes: '' };

export default function StockPage() {
  const { magasinActif, peutChoisir } = useMagasin();

  const mouvParams = magasinActif ? `?magasin_id=${magasinActif}` : '';
  const { data: valorisation, loading: loadingVal }        = useApi<Valorisation>(`/stock/valorisation${mouvParams}`);
  const { data: mouvements = [], loading: loadingMouv, refresh: refreshMouv } = useApi<MouvementStock[]>(`/stock/mouvements${mouvParams}`);
  const { data: produits = [], loading: loadingProd, refresh: refreshProd }   = useApi<Produit[]>('/produits');
  const { data: stocksMagasin = [] }                                           = useApi<StockMagasin[]>(`/stock/par-magasin${mouvParams}`);
  const { data: magasins = [] }                                                 = useApi<Magasin[]>(peutChoisir ? '/magasins' : null);

  const [onglet,  setOnglet]  = useState<FiltreTab>('tous');
  const [ajOpen,  setAjOpen]  = useState(false);
  const [trfOpen, setTrfOpen] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ ...VIDE_AJUST });
  const [trfForm, setTrfForm] = useState({ ...VIDE_TRF });

  const set    = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setTrf = (k: string, v: string) => setTrfForm(f => ({ ...f, [k]: v }));

  // Produits en alerte (depuis stocks par magasin)
  const alertes = useMemo(
    () => (stocksMagasin ?? []).filter(s => s.alerte_stock),
    [stocksMagasin]
  );

  // Stock du produit sélectionné pour le modal
  const produitSelectionne = useMemo(
    () => (produits ?? []).find(p => p.id === Number(form.produit_id)) ?? null,
    [produits, form.produit_id]
  );

  // Filtrage local des mouvements selon l'onglet actif
  const mouvementsFiltres = useMemo(() => {
    const list = mouvements ?? [];
    if (onglet === 'tous') return list;
    return list.filter(m => m.type_mouvement === onglet);
  }, [mouvements, onglet]);

  const handleAjustement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produit_id) { toast('Sélectionnez un produit', 'error'); return; }
    if (!form.motif.trim()) { toast('Le motif est requis', 'error'); return; }
    setSaving(true);
    const qte = Number(form.quantite);
    const res = await api.post('/stock/ajustement', {
      produit_id: Number(form.produit_id),
      quantite:   Math.abs(qte),
      motif:      form.motif.trim(),
      type:       qte >= 0 ? 'entree' : 'sortie',
    });
    setSaving(false);
    if (res.success) {
      toast('Ajustement enregistré', 'success');
      setAjOpen(false);
      setForm({ ...VIDE_AJUST });
      refreshMouv();
      refreshProd();
    } else {
      toast(res.error ?? 'Erreur lors de l\'ajustement', 'error');
    }
  };

  const handleTransfert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfForm.produit_id || !trfForm.magasin_source || !trfForm.magasin_dest || !trfForm.quantite) {
      toast('Tous les champs sont requis', 'error'); return;
    }
    setSaving(true);
    const res = await api.post('/stock/transfert', {
      produit_id:    Number(trfForm.produit_id),
      magasin_source: Number(trfForm.magasin_source),
      magasin_dest:   Number(trfForm.magasin_dest),
      quantite:       Number(trfForm.quantite),
      notes:          trfForm.notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Transfert effectué', 'success');
      setTrfOpen(false);
      setTrfForm({ ...VIDE_TRF });
      refreshMouv();
    } else {
      toast(res.error ?? 'Erreur lors du transfert', 'error');
    }
  };

  const loading = loadingVal || loadingMouv || loadingProd;

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Valorisation, mouvements et ajustements"
        action={
          <div className="flex gap-2">
            {peutChoisir && magasins && magasins.length > 1 && (
              <button className="btn btn-secondary text-xs" onClick={() => setTrfOpen(true)}>
                ⇄ Transfert
              </button>
            )}
            <button className="btn btn-primary text-xs" onClick={() => setAjOpen(true)}>
              + Ajustement
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Section 1 : Valorisation ── */}
        {loadingVal ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'VALEUR STOCK (ACHAT)',  value: fcfaM(valorisation?.val_achat) },
              { label: 'VALEUR STOCK (GROS)',   value: fcfaM(valorisation?.val_gros) },
              { label: 'RÉFÉRENCES ACTIVES',    value: String(valorisation?.references ?? '—') },
              { label: 'UNITÉS TOTALES',        value: String(valorisation?.unites ?? '—') },
            ].map(({ label, value }) => (
              <div key={label} className="metric-card">
                <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
                <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section 2 : Alertes stock ── */}
        {!loadingProd && alertes.length > 0 && (
          <div className="card border border-red-100 bg-red-50/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-red-700">
                Alertes stock
              </h2>
              <span className="font-mono text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {alertes.length} produit{alertes.length > 1 ? 's' : ''} en alerte
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-red-100">
                    {['Désignation', 'Référence', 'Stock actuel', 'Stock alerte'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-red-500 px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertes.map(p => (
                    <tr key={p.produit_id} className="border-b border-red-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-[#1A1917]">{p.designation}</td>
                      <td className="px-3 py-2 font-mono text-[#6B6862]">{p.reference}</td>
                      <td className="px-3 py-2">
                        <span className={p.quantite === 0 ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          {p.quantite} u.
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#6B6862]">{p.stock_alerte} u.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Section 3 : Mouvements ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-[#1A1917]">Mouvements de stock</h2>
            {/* Onglets filtres */}
            <div className="flex gap-1 flex-wrap">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setOnglet(tab.key)}
                  className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${
                    onglet === tab.key
                      ? 'bg-[#1A1917] text-white border-[#1A1917]'
                      : 'bg-white text-[#6B6862] border-black/[0.10] hover:bg-[#F8F7F4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Date', 'Produit', 'Référence', 'Type', 'Quantité', 'Avant', 'Après', 'Motif'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mouvementsFiltres.map(m => {
                    const badge = TYPE_BADGE[m.type_mouvement] ?? { cls: 'bg-gray-100 text-gray-600', label: m.type_mouvement };
                    const isEntree = m.type_mouvement === 'entree' || m.type_mouvement === 'retour';
                    const isSortie = m.type_mouvement === 'sortie';
                    return (
                      <tr key={m.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                        <td className="px-4 py-2.5 font-mono text-[#6B6862] whitespace-nowrap">{fdate(m.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium truncate max-w-[180px]" title={m.designation}>{m.designation ?? '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#6B6862]">{m.reference ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium">
                          <span className={isEntree ? 'text-green-600' : isSortie ? 'text-red-600' : 'text-blue-600'}>
                            {isEntree ? '+' : isSortie ? '-' : ''}{Math.abs(m.quantite)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#6B6862]">{m.stock_avant}</td>
                        <td className="px-4 py-2.5 font-mono text-[#6B6862]">{m.stock_apres}</td>
                        <td className="px-4 py-2.5 text-[#6B6862] max-w-[160px] truncate" title={m.motif ?? ''}>{m.motif ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {mouvementsFiltres.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-[#A8A49E] py-10">
                        Aucun mouvement{onglet !== 'tous' ? ' pour ce filtre' : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Transfert ── */}
      <Modal open={trfOpen} onClose={() => { setTrfOpen(false); setTrfForm({ ...VIDE_TRF }); }} title="Transfert entre magasins">
        <form onSubmit={handleTransfert} className="space-y-4">
          <FormRow label="Produit" required>
            <select
              className="input text-sm"
              value={trfForm.produit_id}
              onChange={e => setTrf('produit_id', e.target.value)}
              required
            >
              <option value="">— Sélectionner un produit —</option>
              {(produits ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.designation} ({p.reference})</option>
              ))}
            </select>
          </FormRow>
          <FormGrid>
            <FormRow label="Magasin source" required>
              <select
                className="input text-sm"
                value={trfForm.magasin_source}
                onChange={e => setTrf('magasin_source', e.target.value)}
                required
              >
                <option value="">— Source —</option>
                {(magasins ?? []).map(mg => (
                  <option key={mg.id} value={mg.id}>{mg.nom}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Magasin destination" required>
              <select
                className="input text-sm"
                value={trfForm.magasin_dest}
                onChange={e => setTrf('magasin_dest', e.target.value)}
                required
              >
                <option value="">— Destination —</option>
                {(magasins ?? []).filter(mg => String(mg.id) !== trfForm.magasin_source).map(mg => (
                  <option key={mg.id} value={mg.id}>{mg.nom}</option>
                ))}
              </select>
            </FormRow>
          </FormGrid>
          <FormRow label="Quantité" required>
            <input
              className="input text-sm font-mono"
              type="number"
              min="1"
              value={trfForm.quantite}
              onChange={e => setTrf('quantite', e.target.value)}
              required
              placeholder="ex: 10"
            />
          </FormRow>
          <FormRow label="Notes">
            <input
              className="input text-sm"
              value={trfForm.notes}
              onChange={e => setTrf('notes', e.target.value)}
              placeholder="Optionnel"
            />
          </FormRow>
          <FormFooter
            onCancel={() => { setTrfOpen(false); setTrfForm({ ...VIDE_TRF }); }}
            loading={saving}
            submitLabel="Effectuer le transfert"
          />
        </form>
      </Modal>

      {/* ── Modal Ajustement ── */}
      <Modal open={ajOpen} onClose={() => { setAjOpen(false); setForm({ ...VIDE_AJUST }); }} title="Ajustement manuel de stock">
        <form onSubmit={handleAjustement} className="space-y-4">
          <FormGrid>
            <FormRow label="Produit" required>
              <select
                className="input text-sm"
                value={form.produit_id}
                onChange={e => set('produit_id', e.target.value)}
                required
              >
                <option value="">— Sélectionner un produit —</option>
                {(produits ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.designation} ({p.reference})</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Stock actuel">
              <input
                className="input text-sm font-mono bg-[#F8F7F4] cursor-not-allowed"
                readOnly
                value={produitSelectionne ? `${produitSelectionne.stock} unités` : '—'}
              />
            </FormRow>
          </FormGrid>
          <FormRow label="Quantité (négatif = diminution)" required>
            <input
              className="input text-sm font-mono"
              type="number"
              value={form.quantite}
              onChange={e => set('quantite', e.target.value)}
              required
              placeholder="ex: 10 ou -3"
            />
          </FormRow>
          <FormRow label="Motif" required>
            <input
              className="input text-sm"
              value={form.motif}
              onChange={e => set('motif', e.target.value)}
              required
              placeholder="Ex : correction inventaire, casse, vol…"
            />
          </FormRow>
          <FormFooter
            onCancel={() => { setAjOpen(false); setForm({ ...VIDE_AJUST }); }}
            loading={saving}
            submitLabel="Enregistrer l'ajustement"
          />
        </form>
      </Modal>
    </>
  );
}
