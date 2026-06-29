import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Devis, DevisLigne, Client, Produit, StatutDevis } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface LigneDevis {
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct: number;
}

interface DevisDetail {
  devis: Devis;
  lignes: DevisLigne[];
}

const ligneVide = (): LigneDevis => ({
  produit_id: 0,
  designation: '',
  quantite: 1,
  prix_unitaire: 0,
  remise_pct: 0,
});

function statutBadge(statut: StatutDevis) {
  const map: Record<StatutDevis, { label: string; cls: string }> = {
    brouillon: { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
    envoye:    { label: 'Envoyé',     cls: 'bg-blue-100 text-blue-700' },
    accepte:   { label: 'Accepté',    cls: 'bg-green-100 text-green-700' },
    refuse:    { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
    expire:    { label: 'Expiré',     cls: 'bg-amber-100 text-amber-700' },
    converti:  { label: 'Converti',   cls: 'bg-purple-100 text-purple-700' },
  };
  const s = map[statut] ?? { label: statut, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const STATUTS_MODIFIABLES: StatutDevis[] = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];

export default function DevisPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/devis${qs ? `?${qs}` : ''}`;
  }, [dateDebut, dateFin]);

  const { data: devis = [], loading, refresh } = useApi<Devis[]>(path);
  const { data: clients = [] } = useApi<Client[]>('/clients');
  const { data: produits = [] } = useApi<Produit[]>('/produits');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Record<number, DevisDetail>>({});
  const [expandLoading, setExpandLoading] = useState<number | null>(null);
  const [statutDropdown, setStatutDropdown] = useState<number | null>(null);

  const [clientId,      setClientId]      = useState('');
  const [dateDevis,     setDateDevis]     = useState(new Date().toISOString().slice(0, 10));
  const [dateValidite,  setDateValidite]  = useState('');
  const [tvaPct,        setTvaPct]        = useState('18');
  const [notes,         setNotes]         = useState('');
  const [lignes,        setLignes]        = useState<LigneDevis[]>([ligneVide()]);

  const totaux = useMemo(() => {
    const sousTotal = lignes.reduce((s, l) => {
      const base = l.quantite * l.prix_unitaire;
      return s + base * (1 - l.remise_pct / 100);
    }, 0);
    const tvaMontant = Math.round(sousTotal * Number(tvaPct) / 100);
    return { sousTotal: Math.round(sousTotal), tvaMontant, totalTtc: Math.round(sousTotal) + tvaMontant };
  }, [lignes, tvaPct]);

  const setLigne = (i: number, k: keyof LigneDevis, v: string | number) =>
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const choisirProduit = (i: number, produitId: number) => {
    const p = (produits ?? []).find(p => p.id === produitId);
    if (!p) return;
    setLignes(ls => ls.map((l, idx) => idx === i
      ? { ...l, produit_id: p.id, designation: p.designation, prix_unitaire: p.prix_detail }
      : l
    ));
  };

  const resetForm = () => {
    setClientId('');
    setDateDevis(new Date().toISOString().slice(0, 10));
    setDateValidite('');
    setTvaPct('18');
    setNotes('');
    setLignes([ligneVide()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = lignes.filter(l => l.produit_id > 0 && l.quantite > 0);
    if (!lignesValides.length) { toast('Ajoutez au moins une ligne produit', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/devis', {
      client_id:     Number(clientId),
      date_devis:    dateDevis,
      date_validite: dateValidite || null,
      tva_pct:       Number(tvaPct),
      lignes:        lignesValides.map(l => ({
        produit_id:    l.produit_id,
        designation:   l.designation,
        quantite:      l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise_pct:    l.remise_pct || null,
      })),
      notes: notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Devis créé avec succès', 'success');
      setOpen(false);
      resetForm();
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const handleConvertir = async (id: number) => {
    const res = await api.post(`/devis/${id}/convertir`, {});
    if (res.success) {
      toast('Devis converti en vente avec succès', 'success');
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la conversion', 'error');
    }
  };

  const handleSupprimer = async (id: number) => {
    if (!window.confirm('Supprimer ce devis ?')) return;
    const res = await api.delete(`/devis/${id}`);
    if (res.success) {
      toast('Devis supprimé', 'success');
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la suppression', 'error');
    }
  };

  const handleStatutChange = async (id: number, statut: StatutDevis) => {
    setStatutDropdown(null);
    const res = await api.put(`/devis/${id}`, { statut });
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
      const res = await api.get(`/devis/${id}`);
      setExpandLoading(null);
      if (res.success && res.data) {
        setExpandedData(prev => ({ ...prev, [id]: res.data as DevisDetail }));
      }
    }
  };

  const totalDevis    = (devis ?? []).reduce((s, d) => s + +d.total_ttc, 0);
  const totalAcceptes = (devis ?? []).filter(d => d.statut === 'accepte').reduce((s, d) => s + +d.total_ttc, 0);
  const enAttente     = (devis ?? []).filter(d => d.statut === 'envoye').length;

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); };
  const hasFilters = dateDebut || dateFin;

  return (
    <>
      <PageHeader
        title="Devis"
        subtitle="Propositions commerciales clients"
        action={<button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau devis</button>}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL DEVIS',    value: fcfaM(totalDevis),    cls: '' },
            { label: 'DEVIS ACCEPTÉS', value: fcfaM(totalAcceptes), cls: 'text-green-700' },
            { label: 'EN ATTENTE',     value: String(enAttente),    cls: enAttente > 0 ? 'text-amber-600' : '' },
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06]">
                      <th className="w-8 px-4 py-2.5" />
                      {['N°', 'Client', 'Date', 'Validité', 'Montant TTC', 'Statut', 'Actions'].map(h => (
                        <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(devis ?? []).map(d => (
                      <React.Fragment key={d.id}>
                        <tr className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => toggleExpand(d.id)}
                              className="text-[#A8A49E] hover:text-[#1A1917] transition-colors"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${expandedId === d.id ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{d.numero}</td>
                          <td className="px-4 py-2.5 font-medium">{d.client_nom}</td>
                          <td className="px-4 py-2.5 font-mono">{fdate(d.date_devis)}</td>
                          <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(d.date_validite)}</td>
                          <td className="px-4 py-2.5 font-mono">{fcfa(+d.total_ttc)}</td>
                          <td className="px-4 py-2.5 relative">
                            <button
                              onClick={() => setStatutDropdown(statutDropdown === d.id ? null : d.id)}
                              className="hover:opacity-80 transition-opacity"
                              id={`statut-btn-${d.id}`}
                            >
                              {statutBadge(d.statut)}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => api.openPdf(`/pdf/devis/${d.id}`)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                                title="Imprimer le devis"
                              >
                                Imprimer
                              </button>
                              {d.statut !== 'converti' && d.statut !== 'refuse' && (
                                <button
                                  onClick={() => handleConvertir(d.id)}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors font-medium"
                                >
                                  Convertir
                                </button>
                              )}
                              {d.statut === 'brouillon' && (
                                <button
                                  onClick={() => handleSupprimer(d.id)}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium"
                                >
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === d.id && (
                          <tr key={`${d.id}-detail`} className="bg-[#FAFAF8]">
                            <td colSpan={8} className="px-8 py-4">
                              {expandLoading === d.id ? (
                                <div className="flex justify-center py-4"><Spinner /></div>
                              ) : expandedData[d.id] ? (
                                <table className="w-full text-xs border border-black/[0.06] rounded-xl overflow-hidden">
                                  <thead className="bg-[#F8F7F4]">
                                    <tr>
                                      {['Désignation', 'Qté', 'Prix unitaire', 'Remise', 'Total ligne'].map(h => (
                                        <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedData[d.id].lignes.map((l, i) => (
                                      <tr key={i} className="border-t border-black/[0.06]">
                                        <td className="px-3 py-2">{l.designation}</td>
                                        <td className="px-3 py-2 font-mono">{l.quantite}</td>
                                        <td className="px-3 py-2 font-mono">{fcfa(l.prix_unitaire)}</td>
                                        <td className="px-3 py-2 font-mono">{l.remise_pct ? `${l.remise_pct}%` : '—'}</td>
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
                    {(devis ?? []).length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun devis enregistré</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Dropdown statut global */}
              {statutDropdown !== null && (
                <div className="fixed inset-0 z-20" onClick={() => setStatutDropdown(null)}>
                  {(() => {
                    const btn = document.getElementById(`statut-btn-${statutDropdown}`);
                    if (!btn) return null;
                    const rect = btn.getBoundingClientRect();
                    const devisItem = (devis ?? []).find(d => d.id === statutDropdown);
                    return (
                      <div 
                        className="fixed z-30 bg-white border border-black/[0.08] rounded-xl shadow-lg py-1 min-w-[130px]"
                        style={{
                          top: `${rect.bottom + 4}px`,
                          left: `${rect.left}px`,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        {STATUTS_MODIFIABLES.map(s => (
                          <button
                            key={s}
                            onClick={() => devisItem && handleStatutChange(devisItem.id, s)}
                            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[#F8F7F4] transition-colors"
                          >
                            {statutBadge(s)}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau devis" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormGrid>
            <FormRow label="Client" required>
              <select className="input text-sm" value={clientId} onChange={e => setClientId(e.target.value)} required>
                <option value="">— Sélectionner un client —</option>
                {(clients ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.raison_sociale}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="TVA (%)">
              <input className="input text-sm font-mono" type="number" min="0"
                value={tvaPct} onChange={e => setTvaPct(e.target.value)} />
            </FormRow>
          </FormGrid>

          <FormGrid>
            <FormRow label="Date devis" required>
              <input className="input text-sm" type="date" value={dateDevis}
                onChange={e => setDateDevis(e.target.value)} required />
            </FormRow>
            <FormRow label="Date validité">
              <input className="input text-sm" type="date" value={dateValidite}
                onChange={e => setDateValidite(e.target.value)} />
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
                    {['Produit', 'Qté', 'Prix unit.', 'Remise %', 'Total', ''].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => {
                    const base = l.quantite * l.prix_unitaire;
                    const totalLigne = Math.round(base * (1 - l.remise_pct / 100));
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
                        <td className="px-3 py-2 w-24">
                          <input className="input text-xs py-1 font-mono text-center" type="number" min="0" max="100"
                            value={l.remise_pct} onChange={e => setLigne(i, 'remise_pct', Number(e.target.value))} />
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

          <FormFooter onCancel={() => { setOpen(false); resetForm(); }} loading={saving} submitLabel="Enregistrer le devis" />
        </form>
      </Modal>
    </>
  );
}
