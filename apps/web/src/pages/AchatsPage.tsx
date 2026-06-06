import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Achat, Fournisseur, Produit } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';
import { exportCsv, CSV_ACHATS } from '../lib/csv';

interface Referentiels { moyens_paiement: {id:number;nom:string}[]; }
interface LigneAchat { produit_id: number; designation: string; quantite: number; prix_unitaire: number; }

const ligneVide = (): LigneAchat => ({ produit_id: 0, designation: '', quantite: 1, prix_unitaire: 0 });

export default function AchatsPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/achats${qs ? `?${qs}` : ''}`;
  }, [dateDebut, dateFin]);

  const { data: achats = [], loading, refresh } = useApi<Achat[]>(path);
  const { data: fournisseurs = [] } = useApi<Fournisseur[]>('/fournisseurs');
  const { data: produits = [] } = useApi<Produit[]>('/produits');
  const { data: refs } = useApi<Referentiels>('/referentiels');

  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const [fournisseurId,   setFournisseurId]   = useState('');
  const [dateAchat,       setDateAchat]       = useState(new Date().toISOString().slice(0, 10));
  const [dateEcheance,    setDateEcheance]    = useState('');
  const [tvaPct,          setTvaPct]          = useState('18');
  const [moyenPaiement,   setMoyenPaiement]   = useState('');
  const [paiementImmed,   setPaiementImmed]   = useState('0');
  const [notes,           setNotes]           = useState('');
  const [lignes,          setLignes]          = useState<LigneAchat[]>([ligneVide()]);

  const totaux = useMemo(() => {
    const sousTotal  = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
    const tvaMontant = Math.round(sousTotal * Number(tvaPct) / 100);
    const totalTtc   = sousTotal + tvaMontant;
    const solde      = totalTtc - Number(paiementImmed);
    return { sousTotal, tvaMontant, totalTtc, solde };
  }, [lignes, tvaPct, paiementImmed]);

  const setLigne = (i: number, k: keyof LigneAchat, v: string | number) =>
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
    setDateAchat(new Date().toISOString().slice(0, 10));
    setDateEcheance(''); setTvaPct('18');
    setMoyenPaiement(''); setPaiementImmed('0'); setNotes('');
    setLignes([ligneVide()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = lignes.filter(l => l.produit_id > 0 && l.quantite > 0);
    if (!lignesValides.length) { toast('Ajoutez au moins une ligne produit', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/achats', {
      fournisseur_id:        Number(fournisseurId),
      date_achat:            dateAchat,
      date_echeance:         dateEcheance || null,
      lignes:                lignesValides,
      tva_pct:               Number(tvaPct),
      moyen_paiement_id:     moyenPaiement ? Number(moyenPaiement) : null,
      montant_paye_immediat: Number(paiementImmed),
      notes:                 notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Achat enregistré avec succès', 'success');
      setOpen(false);
      resetForm();
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const totalAchats = (achats ?? []).reduce((s, a) => s + +a.total_ttc, 0);
  const totalPaye   = (achats ?? []).reduce((s, a) => s + +a.montant_paye, 0);
  const totalDu     = (achats ?? []).reduce((s, a) => s + +a.solde_restant, 0);

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); };
  const hasFilters = dateDebut || dateFin;

  return (
    <>
      <PageHeader title="Achats fournisseurs" subtitle="Réceptions & entrées de stock"
        action={
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={() => exportCsv(achats as unknown as Record<string,unknown>[], CSV_ACHATS, `achats-${new Date().toISOString().slice(0,10)}`)}>↓ CSV</button>
            <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouvel achat</button>
          </div>
        } />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL ACHATS',   value: fcfaM(totalAchats), cls: '' },
            { label: 'TOTAL PAYÉ',     value: fcfaM(totalPaye),   cls: 'text-green-700' },
            { label: 'RESTE À PAYER',  value: fcfaM(totalDu),     cls: totalDu > 0 ? 'text-red-600' : '' },
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
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['N°','Fournisseur','Date','Montant TTC','Payé','Solde','Échéance','Statut'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(achats ?? []).map(a => (
                    <tr key={a.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{a.numero}</td>
                      <td className="px-4 py-2.5 font-medium">{a.fournisseur_nom}</td>
                      <td className="px-4 py-2.5 font-mono">{fdate(a.date_achat)}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(+a.total_ttc)}</td>
                      <td className="px-4 py-2.5 font-mono text-green-700">{fcfa(+a.montant_paye)}</td>
                      <td className="px-4 py-2.5 font-mono">
                        <span className={+a.solde_restant > 0 ? 'text-red-600' : ''}>{fcfa(+a.solde_restant)}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(a.date_echeance)}</td>
                      <td className="px-4 py-2.5"><Badge statut={a.statut_paiement} /></td>
                    </tr>
                  ))}
                  {(achats ?? []).length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun achat enregistré</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal nouvel achat */}
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouvel achat fournisseur" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormGrid>
            <FormRow label="Fournisseur" required>
              <select className="input text-sm" value={fournisseurId} onChange={e => setFournisseurId(e.target.value)} required>
                <option value="">— Sélectionner un fournisseur —</option>
                {(fournisseurs ?? []).map(f => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}
              </select>
            </FormRow>
            <FormRow label="TVA (%)">
              <input className="input text-sm font-mono" type="number" min="0"
                value={tvaPct} onChange={e => setTvaPct(e.target.value)} />
            </FormRow>
          </FormGrid>

          <FormGrid>
            <FormRow label="Date achat" required>
              <input className="input text-sm" type="date" value={dateAchat} onChange={e => setDateAchat(e.target.value)} required />
            </FormRow>
            <FormRow label="Date d'échéance">
              <input className="input text-sm" type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} />
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
                    {['Produit','Qté','Prix achat unit.','Total',''].map(h => (
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

          <FormFooter onCancel={() => { setOpen(false); resetForm(); }} loading={saving} submitLabel="Enregistrer l'achat" />
        </form>
      </Modal>
    </>
  );
}
