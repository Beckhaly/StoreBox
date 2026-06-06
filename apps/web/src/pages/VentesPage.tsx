import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Vente, Client, Produit, VenteLigne } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';
import { exportCsv, CSV_VENTES } from '../lib/csv';

interface Referentiels { moyens_paiement: {id:number;nom:string}[]; }
interface Ligne { produit_id: number; designation: string; prix_unitaire: number; quantite: number; remise_pct: number; }
interface VenteDetail { lignes: (VenteLigne & { designation: string; reference: string })[]; paiements: { id: number; montant: number; date_paiement: string; moyen_paiement: string; reference?: string }[]; }

const ligneVide = (): Ligne => ({ produit_id: 0, designation: '', prix_unitaire: 0, quantite: 1, remise_pct: 0 });

export default function VentesPage() {
  const [typeVente, setTypeVente] = useState('');
  const [statut,    setStatut]    = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');
  
  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (typeVente) p.set('type_vente', typeVente);
    if (statut) p.set('statut', statut);
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/ventes${qs ? `?${qs}` : ''}`;
  }, [typeVente, statut, dateDebut, dateFin]);
  const { data: ventes = [], loading, refresh } = useApi<Vente[]>(path);
  const { data: clients = [] } = useApi<Client[]>('/clients');
  const { data: produits = [] } = useApi<Produit[]>('/produits');
  const { data: refs } = useApi<Referentiels>('/referentiels');

  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulaire vente
  const [clientId,       setClientId]       = useState('');
  const [typeV,          setTypeV]          = useState<'gros'|'detail'>('gros');
  const [dateVente,      setDateVente]      = useState(new Date().toISOString().slice(0,10));
  const [dateEcheance,   setDateEcheance]   = useState('');
  const [remisePct,      setRemisePct]      = useState('0');
  const [tvaPct,         setTvaPct]         = useState('18');
  const [moyenPaiement,  setMoyenPaiement]  = useState('');
  const [paiementImmed,  setPaiementImmed]  = useState('0');
  const [notes,          setNotes]          = useState('');
  const [lignes,         setLignes]         = useState<Ligne[]>([ligneVide()]);

  // Expand
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandData, setExpandData] = useState<Record<number, VenteDetail>>({});
  const [expandLoad, setExpandLoad] = useState<Record<number, boolean>>({});
  
  // État pour le formulaire de paiement
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [paiementVenteId, setPaiementVenteId] = useState<number | null>(null);
  const [paiementMontant, setPaiementMontant] = useState('');
  const [paiementDate, setPaiementDate] = useState(new Date().toISOString().slice(0,10));
  const [paiementMoyen, setPaiementMoyen] = useState('');
  const [paiementRef, setPaiementRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const totaux = useMemo(() => {
    const brut = lignes.reduce((s, l) => s + Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100)), 0);
    const remiseMontant = Math.round(brut * Number(remisePct) / 100);
    const sousTotal = Math.round(brut - remiseMontant);
    const tvaMontant = Math.round(sousTotal * Number(tvaPct) / 100);
    const totalTtc = sousTotal + tvaMontant;
    const solde = totalTtc - Number(paiementImmed);
    return { brut, sousTotal, tvaMontant, totalTtc, solde };
  }, [lignes, remisePct, tvaPct, paiementImmed]);

  const setLigne = (i: number, k: keyof Ligne, v: string | number) =>
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const choisirProduit = (i: number, produitId: number) => {
    const p = (produits ?? []).find(p => p.id === produitId);
    if (!p) return;
    const prix = typeV === 'gros' ? p.prix_gros : p.prix_detail;
    setLignes(ls => ls.map((l, idx) => idx === i
      ? { ...l, produit_id: p.id, designation: p.designation, prix_unitaire: prix }
      : l
    ));
  };

  const resetForm = () => {
    setClientId(''); setTypeV('gros');
    setDateVente(new Date().toISOString().slice(0,10));
    setDateEcheance(''); setRemisePct('0'); setTvaPct('18');
    setMoyenPaiement(''); setPaiementImmed('0'); setNotes('');
    setLignes([ligneVide()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = lignes.filter(l => l.produit_id > 0 && l.quantite > 0);
    if (!lignesValides.length) { toast('Ajoutez au moins une ligne produit', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/ventes', {
      client_id:             Number(clientId),
      type_vente:            typeV,
      date_vente:            dateVente,
      date_echeance:         dateEcheance || null,
      lignes:                lignesValides,
      remise_pct:            Number(remisePct),
      tva_pct:               Number(tvaPct),
      moyen_paiement_id:     moyenPaiement ? Number(moyenPaiement) : null,
      montant_paye_immediat: Number(paiementImmed),
      notes:                 notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Vente enregistrée avec succès', 'success');
      setOpen(false);
      resetForm();
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const toggleExpand = async (v: Vente) => {
    if (expandedId === v.id) { setExpandedId(null); return; }
    setExpandedId(v.id);
    if (expandData[v.id]) return;
    setExpandLoad(l => ({ ...l, [v.id]: true }));
    const res = await api.get<VenteDetail>(`/ventes/${v.id}`);
    setExpandLoad(l => ({ ...l, [v.id]: false }));
    if (res.success) setExpandData(d => ({ ...d, [v.id]: res.data! }));
  };

  const ouvrirPaiement = (venteId: number) => {
    setPaiementVenteId(venteId);
    setPaiementMontant('');
    setPaiementDate(new Date().toISOString().slice(0,10));
    setPaiementMoyen('');
    setPaiementRef('');
    setPaiementOpen(true);
  };

  const enregistrerPaiement = async () => {
    if (!paiementMontant || !paiementVenteId) { toast('Montant requis', 'warn'); return; }
    setPayLoading(true);
    const res = await api.post(`/ventes/${paiementVenteId}/paiement`, {
      montant: Number(paiementMontant),
      date_paiement: paiementDate,
      moyen_paiement_id: paiementMoyen ? Number(paiementMoyen) : null,
      reference: paiementRef || null,
    });
    setPayLoading(false);
    if (res.success) {
      toast('Paiement enregistré', 'success');
      setPaiementOpen(false);
      // Rafraîchir les données de la vente
      if (paiementVenteId && expandData[paiementVenteId]) {
        const newData = await api.get<VenteDetail>(`/ventes/${paiementVenteId}`);
        if (newData.success) setExpandData(d => ({ ...d, [paiementVenteId]: newData.data! }));
      }
      refresh(); // Rafraîchir la liste
    } else {
      toast(res.error ?? 'Erreur lors du paiement', 'error');
    }
  };

  const gros   = (ventes ?? []).filter(v => v.type_vente === 'gros').reduce((s, v) => s + +v.total_ttc, 0);
  const detail = (ventes ?? []).filter(v => v.type_vente === 'detail').reduce((s, v) => s + +v.total_ttc, 0);
  const paye   = (ventes ?? []).reduce((s, v) => s + +v.montant_paye, 0);
  const att    = (ventes ?? []).reduce((s, v) => s + +v.solde_restant, 0);

  const resetFiltres = () => { setTypeVente(''); setStatut(''); setDateDebut(''); setDateFin(''); };
  const hasFilters = typeVente || statut || dateDebut || dateFin;

  return (
    <>
      <PageHeader title="Ventes & commandes" subtitle="Gros et détail"
        action={
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={() => exportCsv(ventes as unknown as Record<string,unknown>[], CSV_VENTES, `ventes-${new Date().toISOString().slice(0,10)}`)}>↓ CSV</button>
            <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouvelle vente</button>
          </div>
        } />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'VENTES GROS',    value: fcfaM(gros),   cls: '' },
            { label: 'VENTES DÉTAIL',  value: fcfaM(detail), cls: '' },
            { label: 'ENCAISSÉ',       value: fcfaM(paye),   cls: 'text-green-700' },
            { label: 'EN ATTENTE',     value: fcfaM(att),    cls: att > 0 ? 'text-red-600' : '' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metric-card">
              <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
              <div className={`text-lg sm:text-[22px] font-light ${cls || 'text-[#1A1917]'}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="w-full sm:w-auto text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono"
            value={typeVente} onChange={e => setTypeVente(e.target.value)}>
            <option value="">Gros + Détail</option>
            <option value="gros">Gros seulement</option>
            <option value="detail">Détail seulement</option>
          </select>
          <select className="w-full sm:w-auto text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono"
            value={statut} onChange={e => setStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="non_paye">Non payé</option>
            <option value="partiel">Partiel</option>
            <option value="paye">Payé</option>
            <option value="en_retard">En retard</option>
          </select>
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
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['','N°','Client','Montant TTC','Payé','Solde','Type','Date','Statut','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ventes ?? []).map(v => (
                    <React.Fragment key={v.id}>
                    <tr
                      className={`border-b border-black/[0.04] hover:bg-[#F8F7F4] cursor-pointer ${expandedId === v.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleExpand(v)}>
                      <td className="px-3 py-2.5 text-[#A8A49E] text-center w-6">
                        <span className="text-[10px]">{expandedId === v.id ? '▼' : '▶'}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{v.numero}</td>
                      <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">{v.client_nom}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(+v.total_ttc)}</td>
                      <td className="px-4 py-2.5 font-mono text-green-700">{fcfa(+v.montant_paye)}</td>
                      <td className="px-4 py-2.5 font-mono">
                        <span className={+v.solde_restant > 0 ? 'text-red-600' : ''}>{fcfa(+v.solde_restant)}</span>
                      </td>
                      <td className="px-4 py-2.5"><Badge statut={v.type_vente} /></td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(v.date_vente)}</td>
                      <td className="px-4 py-2.5"><Badge statut={v.statut_paiement} /></td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <button className="btn text-[10px] px-2 py-1" onClick={() => api.openPdf(`/pdf/facture/${v.id}`)}>PDF</button>
                      </td>
                    </tr>

                    {expandedId === v.id && (
                      <tr key={`expand-${v.id}`} className="bg-blue-50/30">
                        <td colSpan={10} className="px-8 py-3">
                          {expandLoad[v.id] ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                          ) : expandData[v.id] ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                              {/* Lignes produits */}
                              <div>
                                <div className="text-[11px] font-mono text-[#6B6862] uppercase mb-2">Lignes produits</div>
                                <table className="w-full text-xs border border-black/[0.08] rounded-lg overflow-hidden">
                                  <thead className="bg-white">
                                    <tr>
                                      {['Désignation','Qté','Prix unit.','Total'].map(h => (
                                        <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandData[v.id].lignes ?? []).map((l, i) => (
                                      <tr key={i} className="border-t border-black/[0.06]">
                                        <td className="px-3 py-1.5">
                                          <div>{l.designation}</div>
                                          <div className="font-mono text-[10px] text-[#A8A49E]">{l.reference}</div>
                                        </td>
                                        <td className="px-3 py-1.5 font-mono">{l.quantite}</td>
                                        <td className="px-3 py-1.5 font-mono">{fcfa(l.prix_unitaire)}</td>
                                        <td className="px-3 py-1.5 font-mono font-medium">{fcfa(l.total_ligne)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Paiements */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-[11px] font-mono text-[#6B6862] uppercase">Historique paiements</div>
                                  {+v.solde_restant > 0 && (
                                    <button className="btn text-[10px] px-2 py-1" onClick={() => ouvrirPaiement(v.id)}>
                                      + Ajouter paiement
                                    </button>
                                  )}
                                </div>
                                {(expandData[v.id].paiements ?? []).length === 0 ? (
                                  <div className="text-[11px] text-[#A8A49E] py-2">Aucun paiement reçu</div>
                                ) : (
                                  <table className="w-full text-xs border border-black/[0.08] rounded-lg overflow-hidden">
                                    <thead className="bg-white">
                                      <tr>
                                        {['Date','Moyen','Montant','Réf.'].map(h => (
                                          <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(expandData[v.id].paiements ?? []).map(p => (
                                        <tr key={p.id} className="border-t border-black/[0.06]">
                                          <td className="px-3 py-1.5 font-mono">{fdate(p.date_paiement)}</td>
                                          <td className="px-3 py-1.5 text-[#6B6862]">{p.moyen_paiement ?? '—'}</td>
                                          <td className="px-3 py-1.5 font-mono text-green-700">{fcfa(p.montant)}</td>
                                          <td className="px-3 py-1.5 font-mono text-[10px] text-[#A8A49E]">{p.reference ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>))}
                  {(ventes ?? []).length === 0 && (
                    <tr><td colSpan={10} className="text-center text-[#A8A49E] py-10">Aucune vente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal nouvelle vente */}
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvelle vente" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormGrid>
            <FormRow label="Client" required>
              <select className="input text-sm" value={clientId} onChange={e => setClientId(e.target.value)} required>
                <option value="">— Sélectionner un client —</option>
                {(clients ?? []).map(c => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
              </select>
            </FormRow>
            <FormRow label="Type de vente" required>
              <select className="input text-sm" value={typeV} onChange={e => setTypeV(e.target.value as 'gros'|'detail')}>
                <option value="gros">Gros</option>
                <option value="detail">Détail</option>
              </select>
            </FormRow>
          </FormGrid>

          <FormGrid>
            <FormRow label="Date de vente" required>
              <input className="input text-sm" type="date" value={dateVente} onChange={e => setDateVente(e.target.value)} required />
            </FormRow>
            <FormRow label="Date d'échéance">
              <input className="input text-sm" type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} />
            </FormRow>
          </FormGrid>

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
                    {['Produit','Qté','Prix unit.','Remise %','Total',''].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => {
                    const totalLigne = Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100));
                    return (
                      <tr key={i} className="border-t border-black/[0.06]">
                        <td className="px-3 py-2 min-w-[180px]">
                          <select className="input text-xs py-1" value={l.produit_id || ''}
                            onChange={e => choisirProduit(i, Number(e.target.value))}>
                            <option value="">— Produit —</option>
                            {(produits ?? []).map(p => (
                              <option key={p.id} value={p.id}>{p.designation} ({p.stock} u.)</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-20">
                          <input className="input text-xs py-1 font-mono text-center" type="number" min="1"
                            value={l.quantite} onChange={e => setLigne(i, 'quantite', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input className="input text-xs py-1 font-mono" type="number" min="0"
                            value={l.prix_unitaire} onChange={e => setLigne(i, 'prix_unitaire', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 w-20">
                          <input className="input text-xs py-1 font-mono text-center" type="number" min="0" max="100"
                            value={l.remise_pct} onChange={e => setLigne(i, 'remise_pct', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 w-28 font-mono text-right text-[#1A1917]">{fcfa(totalLigne)}</td>
                        <td className="px-3 py-2 w-8">
                          {lignes.length > 1 && (
                            <button type="button" onClick={() => setLignes(ls => ls.filter((_, idx) => idx !== i))}
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
            <div className="space-y-3">
              <FormGrid>
                <FormRow label="Remise globale (%)">
                  <input className="input text-sm font-mono" type="number" min="0" max="100"
                    value={remisePct} onChange={e => setRemisePct(e.target.value)} />
                </FormRow>
                <FormRow label="TVA (%)">
                  <input className="input text-sm font-mono" type="number" min="0"
                    value={tvaPct} onChange={e => setTvaPct(e.target.value)} />
                </FormRow>
              </FormGrid>
              <FormGrid>
                <FormRow label="Moyen de paiement">
                  <select className="input text-sm" value={moyenPaiement} onChange={e => setMoyenPaiement(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {(refs?.moyens_paiement ?? []).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Paiement immédiat (F)">
                  <input className="input text-sm font-mono" type="number" min="0"
                    value={paiementImmed} onChange={e => setPaiementImmed(e.target.value)} />
                </FormRow>
              </FormGrid>
              <FormRow label="Notes">
                <textarea className="input text-sm resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </FormRow>
            </div>
            <div className="bg-[#F8F7F4] rounded-xl p-4 flex flex-col justify-center gap-2 text-sm">
              {[
                { label: 'Sous-total HT',    value: fcfa(totaux.sousTotal),  cls: '' },
                { label: `TVA (${tvaPct}%)`, value: fcfa(totaux.tvaMontant), cls: 'text-[#6B6862]' },
              ].map(({ label, value, cls }) => (
                <div key={label} className={`flex justify-between ${cls}`}>
                  <span className="text-[#6B6862]">{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-base border-t border-black/[0.10] pt-2 mt-1">
                <span>Total TTC</span>
                <span className="font-mono">{fcfa(totaux.totalTtc)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Payé</span>
                <span className="font-mono">{fcfa(Number(paiementImmed))}</span>
              </div>
              <div className={`flex justify-between font-medium ${totaux.solde > 0 ? 'text-red-600' : 'text-green-700'}`}>
                <span>Solde restant</span>
                <span className="font-mono">{fcfa(totaux.solde)}</span>
              </div>
            </div>
          </div>

          <FormFooter onCancel={() => { setOpen(false); resetForm(); }} loading={saving} submitLabel="Enregistrer la vente" />
        </form>
      </Modal>

      {/* Modal paiement */}
      <Modal open={paiementOpen} onClose={() => setPaiementOpen(false)} title="Enregistrer un paiement" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); enregistrerPaiement(); }} className="space-y-4">
          <FormGrid>
            <FormRow label="Montant (F)" required>
              <input className="input text-sm font-mono" type="number" min="0" step="1"
                value={paiementMontant} onChange={e => setPaiementMontant(e.target.value)} required />
            </FormRow>
            <FormRow label="Date" required>
              <input className="input text-sm" type="date" value={paiementDate} onChange={e => setPaiementDate(e.target.value)} required />
            </FormRow>
          </FormGrid>
          
          <FormGrid>
            <FormRow label="Moyen de paiement">
              <select className="input text-sm" value={paiementMoyen} onChange={e => setPaiementMoyen(e.target.value)}>
                <option value="">— Choisir —</option>
                {(refs?.moyens_paiement ?? []).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </FormRow>
            <FormRow label="Référence (chèque, etc)">
              <input className="input text-sm" type="text" placeholder="N° de chèque ou transaction ID"
                value={paiementRef} onChange={e => setPaiementRef(e.target.value)} />
            </FormRow>
          </FormGrid>

          <FormFooter onCancel={() => setPaiementOpen(false)} loading={payLoading} submitLabel="Enregistrer" />
        </form>
      </Modal>
    </>
  );
}
