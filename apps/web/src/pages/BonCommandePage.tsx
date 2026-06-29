import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { BonCommande, Fournisseur, Produit, StatutBC } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface LigneBC {
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
}

interface BCDetail {
  bon_commande: BonCommande;
  lignes: {
    produit_id: number;
    designation: string;
    quantite: number;
    prix_unitaire: number;
    total_ligne: number;
  }[];
}

const ligneVide = (): LigneBC => ({
  produit_id: 0,
  designation: '',
  quantite: 1,
  prix_unitaire: 0,
});

function statutBadge(statut: StatutBC) {
  const map: Record<StatutBC, { label: string; cls: string }> = {
    brouillon:    { label: 'Brouillon',   cls: 'bg-gray-100 text-gray-600' },
    envoye:       { label: 'Envoyé',      cls: 'bg-blue-100 text-blue-700' },
    confirme:     { label: 'Confirmé',    cls: 'bg-green-100 text-green-700' },
    receptionne_partiel: { label: 'Reçu partiel', cls: 'bg-amber-100 text-amber-700' },
    receptionne:  { label: 'Réceptionné', cls: 'bg-green-200 text-green-800' },
    annule:       { label: 'Annulé',      cls: 'bg-red-100 text-red-700' },
  };
  const s = map[statut] ?? { label: statut, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const STATUTS_MODIFIABLES: StatutBC[] = ['brouillon', 'envoye', 'confirme', 'annule'];
const PEUT_RECEPTIONNER: StatutBC[] = ['confirme'];

export default function BonCommandePage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/bons-commande${qs ? `?${qs}` : ''}`;
  }, [dateDebut, dateFin]);

  const { data: bonsCommande = [], loading, refresh } = useApi<BonCommande[]>(path);
  const { data: fournisseurs = [] } = useApi<Fournisseur[]>('/fournisseurs');
  const { data: produits = [] } = useApi<Produit[]>('/produits');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Record<number, BCDetail>>({});
  const [expandLoading, setExpandLoading] = useState<number | null>(null);
  const [statutDropdown, setStatutDropdown] = useState<number | null>(null);

  const [fournisseurId,      setFournisseurId]      = useState('');
  const [dateCommande,       setDateCommande]       = useState(new Date().toISOString().slice(0, 10));
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState('');
  const [tvaPct,             setTvaPct]             = useState('18');
  const [notes,              setNotes]              = useState('');
  const [lignes,             setLignes]             = useState<LigneBC[]>([ligneVide()]);

  const totaux = useMemo(() => {
    const sousTotal  = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    const tvaMontant = Math.round(sousTotal * Number(tvaPct) / 100);
    const totalTtc   = sousTotal + tvaMontant;
    return { sousTotal, tvaMontant, totalTtc };
  }, [lignes, tvaPct]);

  const setLigne = (i: number, k: keyof LigneBC, v: string | number) =>
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const choisirProduit = (i: number, produitId: number) => {
    const p = (produits ?? []).find(p => p.id === produitId);
    if (!p) return;
    setLignes(ls => ls.map((l, idx) => idx === i
      ? { ...l, produit_id: p.id, designation: p.designation, prix_unitaire: p.prix_achat }
      : l
    ));
  };

  const resetForm = () => {
    setFournisseurId('');
    setDateCommande(new Date().toISOString().slice(0, 10));
    setDateLivraisonPrevue('');
    setTvaPct('18');
    setNotes('');
    setLignes([ligneVide()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = lignes.filter(l => l.produit_id > 0 && l.quantite > 0);
    if (!lignesValides.length) { toast('Ajoutez au moins une ligne produit', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/bons-commande', {
      fournisseur_id:        Number(fournisseurId),
      date_commande:         dateCommande,
      date_livraison_prevue: dateLivraisonPrevue || null,
      tva_pct:               Number(tvaPct),
      lignes:                lignesValides,
      notes:                 notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Bon de commande créé avec succès', 'success');
      setOpen(false);
      resetForm();
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const handleReceptionner = async (id: number) => {
    const res = await api.post(`/bons-commande/${id}/receptionner`, {});
    if (res.success) {
      toast('Réception enregistrée — achat créé', 'success');
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la réception', 'error');
    }
  };

  const handleStatutChange = async (id: number, statut: StatutBC) => {
    setStatutDropdown(null);
    const res = await api.put(`/bons-commande/${id}/statut`, { statut });
    if (res.success) {
      toast('Statut mis à jour', 'success');
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la mise à jour', 'error');
    }
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedData[id]) {
      setExpandLoading(id);
      const res = await api.get(`/bons-commande/${id}`);
      setExpandLoading(null);
      if (res.success && res.data) {
        setExpandedData(prev => ({ ...prev, [id]: res.data as BCDetail }));
      }
    }
  };

  const totalBC       = (bonsCommande ?? []).reduce((s, b) => s + +b.total_ttc, 0);
  const valeurAttendue = (bonsCommande ?? [])
    .filter(b => !['recu', 'annule'].includes(b.statut))
    .reduce((s, b) => s + +b.total_ttc, 0);
  const enCours       = (bonsCommande ?? []).filter(b => ['envoye', 'confirme', 'partiellement_recu'].includes(b.statut)).length;

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); };
  const hasFilters = dateDebut || dateFin;

  return (
    <>
      <PageHeader
        title="Bons de commande"
        subtitle="Commandes fournisseurs"
        action={<button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau BC</button>}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL BC',          value: fcfaM(totalBC),        cls: '' },
            { label: 'VALEUR ATTENDUE',   value: fcfaM(valeurAttendue), cls: valeurAttendue > 0 ? 'text-amber-600' : '' },
            { label: 'EN COURS',          value: String(enCours),       cls: enCours > 0 ? 'text-blue-600' : '' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metric-card">
              <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
              <div className={`text-lg sm:text-[22px] font-light ${cls || 'text-[#1A1917]'}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono" />
          </div>
          {hasFilters && (
            <button className="btn text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={resetFiltres}>
              ✕ Réinitialiser
            </button>
          )}
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    <th className="w-8 px-4 py-2.5" />
                    {['N°', 'Fournisseur', 'Date', 'Livraison prévue', 'Montant TTC', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(bonsCommande ?? []).map(b => (
                    <React.Fragment key={b.id}>
                      <tr className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => toggleExpand(b.id)}
                            className="text-[#A8A49E] hover:text-[#1A1917] transition-colors"
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform ${expandedId === b.id ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{b.numero}</td>
                        <td className="px-4 py-2.5 font-medium">{b.fournisseur_nom}</td>
                        <td className="px-4 py-2.5 font-mono">{fdate(b.date_commande)}</td>
                        <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(b.date_livraison_prevue)}</td>
                        <td className="px-4 py-2.5 font-mono">{fcfa(+b.total_ttc)}</td>
                        <td className="px-4 py-2.5 relative">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setStatutDropdown(statutDropdown === b.id ? null : b.id)}
                              className="hover:opacity-80 transition-opacity"
                            >
                              {statutBadge(b.statut)}
                            </button>
                            {statutDropdown === b.id && (
                              <div className="absolute z-20 top-6 left-0 bg-white border border-black/[0.08] rounded-xl shadow-lg py-1 min-w-[160px]">
                                {STATUTS_MODIFIABLES.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleStatutChange(b.id, s)}
                                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[#F8F7F4] transition-colors"
                                  >
                                    {statutBadge(s)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {PEUT_RECEPTIONNER.includes(b.statut) && (
                            <button
                              onClick={() => handleReceptionner(b.id)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium"
                            >
                              Réceptionner
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === b.id && (
                        <tr key={`${b.id}-detail`} className="bg-[#FAFAF8]">
                          <td colSpan={8} className="px-8 py-4">
                            {expandLoading === b.id ? (
                              <div className="flex justify-center py-4"><Spinner /></div>
                            ) : expandedData[b.id] ? (
                              <table className="w-full text-xs border border-black/[0.06] rounded-xl overflow-hidden">
                                <thead className="bg-[#F8F7F4]">
                                  <tr>
                                    {['Désignation', 'Qté', 'Prix unitaire', 'Total ligne'].map(h => (
                                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedData[b.id].lignes.map((l, i) => (
                                    <tr key={i} className="border-t border-black/[0.06]">
                                      <td className="px-3 py-2">{l.designation}</td>
                                      <td className="px-3 py-2 font-mono">{l.quantite}</td>
                                      <td className="px-3 py-2 font-mono">{fcfa(l.prix_unitaire)}</td>
                                      <td className="px-3 py-2 font-mono">{fcfa(l.total_ligne)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <span className="text-[#A8A49E] text-xs">Aucune ligne disponible</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {(bonsCommande ?? []).length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun bon de commande enregistré</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fermer les dropdowns en cliquant ailleurs */}
      {statutDropdown !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setStatutDropdown(null)} />
      )}

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau bon de commande" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormGrid>
            <FormRow label="Fournisseur" required>
              <select className="input text-sm" value={fournisseurId} onChange={e => setFournisseurId(e.target.value)} required>
                <option value="">— Sélectionner un fournisseur —</option>
                {(fournisseurs ?? []).map(f => (
                  <option key={f.id} value={f.id}>{f.raison_sociale}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="TVA (%)">
              <input className="input text-sm font-mono" type="number" min="0"
                value={tvaPct} onChange={e => setTvaPct(e.target.value)} />
            </FormRow>
          </FormGrid>

          <FormGrid>
            <FormRow label="Date commande" required>
              <input className="input text-sm" type="date" value={dateCommande}
                onChange={e => setDateCommande(e.target.value)} required />
            </FormRow>
            <FormRow label="Livraison prévue">
              <input className="input text-sm" type="date" value={dateLivraisonPrevue}
                onChange={e => setDateLivraisonPrevue(e.target.value)} />
            </FormRow>
          </FormGrid>

          {/* Lignes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-[#6B6862] uppercase tracking-wide">Lignes de produits</span>
              <button type="button" className="btn text-[10px] px-2 py-1"
                onClick={() => setLignes(ls => [...ls, ligneVide()])}>
                + Ajouter ligne
              </button>
            </div>
            <div className="border border-black/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#F8F7F4]">
                  <tr>
                    {['Produit', 'Qté', 'Prix achat unit.', 'Total', ''].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => {
                    const totalLigne = l.quantite * l.prix_unitaire;
                    return (
                      <tr key={i} className="border-t border-black/[0.06]">
                        <td className="px-3 py-2 min-w-[200px]">
                          <select className="input text-xs py-1" value={l.produit_id || ''}
                            onChange={e => choisirProduit(i, Number(e.target.value))}>
                            <option value="">— Produit —</option>
                            {(produits ?? []).map(p => (
                              <option key={p.id} value={p.id}>{p.designation}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-20">
                          <input className="input text-xs py-1 font-mono text-center" type="number" min="1"
                            value={l.quantite} onChange={e => setLigne(i, 'quantite', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 w-32">
                          <input className="input text-xs py-1 font-mono" type="number" min="0"
                            value={l.prix_unitaire} onChange={e => setLigne(i, 'prix_unitaire', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 w-28 font-mono text-right">{fcfa(totalLigne)}</td>
                        <td className="px-3 py-2 w-8">
                          {lignes.length > 1 && (
                            <button type="button"
                              onClick={() => setLignes(ls => ls.filter((_, idx) => idx !== i))}
                              className="text-[#A8A49E] hover:text-red-500 transition-colors text-base leading-none">×</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <FormRow label="Notes">
              <textarea className="input text-sm resize-none" rows={3} value={notes}
                onChange={e => setNotes(e.target.value)} />
            </FormRow>
            <div className="bg-[#F8F7F4] rounded-xl p-4 flex flex-col justify-center gap-2 text-sm">
              <div className="flex justify-between text-[#6B6862]">
                <span>Sous-total HT</span>
                <span className="font-mono">{fcfa(totaux.sousTotal)}</span>
              </div>
              <div className="flex justify-between text-[#6B6862]">
                <span>TVA ({tvaPct}%)</span>
                <span className="font-mono">{fcfa(totaux.tvaMontant)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t border-black/[0.10] pt-2 mt-1">
                <span>Total TTC</span>
                <span className="font-mono">{fcfa(totaux.totalTtc)}</span>
              </div>
            </div>
          </div>

          <FormFooter onCancel={() => { setOpen(false); resetForm(); }} loading={saving} submitLabel="Enregistrer le bon de commande" />
        </form>
      </Modal>
    </>
  );
}
