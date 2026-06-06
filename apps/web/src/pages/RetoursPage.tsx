import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Retour, Vente, Produit, StatutRetour } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface LigneRetour {
  produit_id: number;
  quantite: number;
  prix_unitaire: number;
  motif: string;
}

const ligneVide = (): LigneRetour => ({
  produit_id: 0,
  quantite: 1,
  prix_unitaire: 0,
  motif: '',
});

function statutBadge(statut: StatutRetour) {
  const map: Record<StatutRetour, { label: string; cls: string }> = {
    en_attente: { label: 'En attente', cls: 'bg-blue-100 text-blue-700' },
    traite:     { label: 'Traité',     cls: 'bg-green-100 text-green-700' },
    annule:     { label: 'Annulé',     cls: 'bg-red-100 text-red-700' },
  };
  const s = map[statut] ?? { label: statut, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const TRANSITIONS: Record<StatutRetour, StatutRetour[]> = {
  en_attente: ['traite', 'annule'],
  traite:     [],
  annule:     [],
};

export default function RetoursPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/retours${qs ? `?${qs}` : ''}`;
  }, [dateDebut, dateFin]);

  const { data: retours = [], loading, refresh } = useApi<Retour[]>(path);
  const { data: ventes = [] } = useApi<Vente[]>('/ventes');
  const { data: produits = [] } = useApi<Produit[]>('/produits');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statutDropdown, setStatutDropdown] = useState<number | null>(null);

  const [venteId,  setVenteId]  = useState('');
  const [raison,   setRaison]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [lignes,   setLignes]   = useState<LigneRetour[]>([ligneVide()]);

  const setLigne = (i: number, k: keyof LigneRetour, v: string | number) =>
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const choisirProduit = (i: number, produitId: number) => {
    const p = (produits ?? []).find(p => p.id === produitId);
    if (!p) return;
    setLignes(ls => ls.map((l, idx) => idx === i
      ? { ...l, produit_id: p.id, prix_unitaire: p.prix_detail }
      : l
    ));
  };

  const resetForm = () => {
    setVenteId('');
    setRaison('');
    setNotes('');
    setLignes([ligneVide()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = lignes.filter(l => l.produit_id > 0 && l.quantite > 0);
    if (!lignesValides.length) { toast('Ajoutez au moins une ligne produit', 'warn'); return; }
    if (!raison.trim()) { toast('La raison du retour est requise', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/retours', {
      vente_id: Number(venteId),
      raison:   raison.trim(),
      lignes:   lignesValides.map(l => ({
        produit_id:    l.produit_id,
        quantite:      l.quantite,
        prix_unitaire: l.prix_unitaire,
        motif:         l.motif || null,
      })),
      notes: notes || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Retour enregistré avec succès', 'success');
      setOpen(false);
      resetForm();
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const handleStatutChange = async (id: number, statut: StatutRetour) => {
    setStatutDropdown(null);
    const res = await api.put(`/retours/${id}/statut`, { statut });
    if (res.success) {
      toast('Statut mis à jour', 'success');
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la mise à jour', 'error');
    }
  };

  const now = new Date();
  const moisCourant = now.getMonth();
  const anneeCourrante = now.getFullYear();
  const retoursMois = (retours ?? []).filter(r => {
    const d = new Date(r.date_retour);
    return d.getMonth() === moisCourant && d.getFullYear() === anneeCourrante;
  });
  const valeurTotale = (retours ?? []).reduce((s, r) => s + +r.montant_total, 0);

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); };
  const hasFilters = dateDebut || dateFin;

  return (
    <>
      <PageHeader
        title="Retours"
        subtitle="Retours clients & avoirs"
        action={<button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau retour</button>}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {[
            { label: 'RETOURS CE MOIS', value: String(retoursMois.length), cls: '' },
            { label: 'VALEUR TOTALE',   value: fcfaM(valeurTotale),        cls: valeurTotale > 0 ? 'text-red-600' : '' },
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
                    {['N°', 'Client', 'Date', 'Raison', 'Montant', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(retours ?? []).map(r => {
                    const suivants = TRANSITIONS[r.statut] ?? [];
                    return (
                      <tr key={r.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                        <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{r.numero}</td>
                        <td className="px-4 py-2.5 font-medium">{r.client_nom ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono">{fdate(r.date_retour)}</td>
                        <td className="px-4 py-2.5 max-w-[180px] truncate text-[#6B6862]">{r.raison}</td>
                        <td className="px-4 py-2.5 font-mono">{fcfa(+r.montant_total)}</td>
                        <td className="px-4 py-2.5">{statutBadge(r.statut)}</td>
                        <td className="px-4 py-2.5">
                          {suivants.length > 0 && (
                            <div className="relative inline-block">
                              <button
                                onClick={() => setStatutDropdown(statutDropdown === r.id ? null : r.id)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8F7F4] text-[#6B6862] hover:bg-[#EDECE8] transition-colors font-medium border border-black/[0.08]"
                              >
                                Changer statut ▾
                              </button>
                              {statutDropdown === r.id && (
                                <div className="absolute z-20 top-6 left-0 bg-white border border-black/[0.08] rounded-xl shadow-lg py-1 min-w-[130px]">
                                  {suivants.map(s => (
                                    <button
                                      key={s}
                                      onClick={() => handleStatutChange(r.id, s)}
                                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[#F8F7F4] transition-colors"
                                    >
                                      {statutBadge(s)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(retours ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-[#A8A49E] py-10">Aucun retour enregistré</td>
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

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Nouveau retour client" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormRow label="Vente concernée" required>
            <select className="input text-sm" value={venteId} onChange={e => setVenteId(e.target.value)} required>
              <option value="">— Sélectionner une vente —</option>
              {(ventes ?? []).map(v => (
                <option key={v.id} value={v.id}>
                  {v.numero} — {v.client_nom}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Raison du retour" required>
            <textarea
              className="input text-sm resize-none"
              rows={2}
              value={raison}
              onChange={e => setRaison(e.target.value)}
              placeholder="Décrivez la raison du retour…"
              required
            />
          </FormRow>

          {/* Lignes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-[#6B6862] uppercase tracking-wide">Articles retournés</span>
              <button type="button" className="btn text-[10px] px-2 py-1"
                onClick={() => setLignes(ls => [...ls, ligneVide()])}>
                + Ajouter ligne
              </button>
            </div>
            <div className="border border-black/[0.08] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#F8F7F4]">
                  <tr>
                    {['Produit', 'Qté', 'Prix unit.', 'Motif', 'Total', ''].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => {
                    const totalLigne = l.quantite * l.prix_unitaire;
                    return (
                      <tr key={i} className="border-t border-black/[0.06]">
                        <td className="px-3 py-2 min-w-[180px]">
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
                        <td className="px-3 py-2 min-w-[140px]">
                          <input className="input text-xs py-1" type="text"
                            value={l.motif} onChange={e => setLigne(i, 'motif', e.target.value)}
                            placeholder="Défaut, erreur…" />
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

          <FormGrid>
            <FormRow label="Notes">
              <textarea className="input text-sm resize-none" rows={2} value={notes}
                onChange={e => setNotes(e.target.value)} />
            </FormRow>
            <div className="bg-[#F8F7F4] rounded-xl p-4 flex flex-col justify-center gap-2 text-sm">
              <div className="flex justify-between font-semibold text-base">
                <span>Montant total</span>
                <span className="font-mono">
                  {fcfa(lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0))}
                </span>
              </div>
              <div className="text-[11px] text-[#A8A49E]">
                {lignes.filter(l => l.produit_id > 0).length} article(s) retourné(s)
              </div>
            </div>
          </FormGrid>

          <FormFooter onCancel={() => { setOpen(false); resetForm(); }} loading={saving} submitLabel="Enregistrer le retour" />
        </form>
      </Modal>
    </>
  );
}
