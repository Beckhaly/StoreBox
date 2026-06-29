import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Fournisseur, Achat } from '@storebox/shared';
import { fcfa, fdate } from '../lib/formatters';
import { api } from '../lib/api';

const VIDE = {
  code: '', raison_sociale: '', contact_nom: '', telephone: '',
  email: '', adresse: '', pays: "Côte d'Ivoire", delai_paiement: '30', conditions: '',
};

export default function FournisseursPage() {
  const { data: frs = [], loading, refresh } = useApi<Fournisseur[]>('/fournisseurs');

  // Création
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({ ...VIDE });

  // Édition
  const [editFrs,   setEditFrs]   = useState<Fournisseur | null>(null);
  const [editForm,  setEditForm]  = useState({ ...VIDE });
  const [editSaving,setEditSaving]= useState(false);

  // Expand
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandData, setExpandData] = useState<Record<number, Achat[]>>({});
  const [expandLoad, setExpandLoad] = useState<Record<number, boolean>>({});

  const set     = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/fournisseurs', {
      ...form,
      delai_paiement: Number(form.delai_paiement) || 30,
    });
    setSaving(false);
    if (res.success) {
      toast('Fournisseur créé avec succès', 'success');
      setOpen(false);
      setForm({ ...VIDE });
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const openEdit = (f: Fournisseur) => {
    setEditFrs(f);
    setEditForm({
      code:           f.code,
      raison_sociale: f.raison_sociale,
      contact_nom:    f.contact_nom    ?? '',
      telephone:      f.telephone      ?? '',
      email:          f.email          ?? '',
      adresse:        '',
      pays:           f.pays           ?? "Côte d'Ivoire",
      delai_paiement: String(f.delai_paiement ?? 30),
      conditions:     '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFrs) return;
    setEditSaving(true);
    const res = await api.put(`/fournisseurs/${editFrs.id}`, {
      ...editForm,
      delai_paiement: Number(editForm.delai_paiement) || 30,
    });
    setEditSaving(false);
    if (res.success) {
      toast('Fournisseur modifié', 'success');
      setEditFrs(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (f: Fournisseur) => {
    if (!confirm(`Désactiver le fournisseur "${f.raison_sociale}" ?`)) return;
    const res = await api.delete(`/fournisseurs/${f.id}`);
    if (res.success) { toast('Fournisseur désactivé', 'success'); refresh(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  const toggleExpand = async (f: Fournisseur) => {
    if (expandedId === f.id) { setExpandedId(null); return; }
    setExpandedId(f.id);
    if (expandData[f.id]) return;
    setExpandLoad(l => ({ ...l, [f.id]: true }));
    const res = await api.get<Achat[]>(`/achats?fournisseur_id=${f.id}`);
    setExpandLoad(l => ({ ...l, [f.id]: false }));
    if (res.success) setExpandData(d => ({ ...d, [f.id]: res.data ?? [] }));
  };

  const FormFields = ({ f, s }: { f: typeof VIDE; s: (k: string, v: string) => void }) => (
    <>
      <FormGrid>
        <FormRow label="Code" required>
          <input className="input text-sm font-mono" value={f.code} onChange={e => s('code', e.target.value)} required placeholder="FRS-009" />
        </FormRow>
        <FormRow label="Délai paiement (jours)">
          <input className="input text-sm font-mono" type="number" min="0" value={f.delai_paiement} onChange={e => s('delai_paiement', e.target.value)} />
        </FormRow>
      </FormGrid>
      <FormRow label="Raison sociale" required>
        <input className="input text-sm" value={f.raison_sociale} onChange={e => s('raison_sociale', e.target.value)} required placeholder="Nom du fournisseur" />
      </FormRow>
      <FormGrid>
        <FormRow label="Contact">
          <input className="input text-sm" value={f.contact_nom} onChange={e => s('contact_nom', e.target.value)} placeholder="Nom du contact" />
        </FormRow>
        <FormRow label="Téléphone">
          <input className="input text-sm" value={f.telephone} onChange={e => s('telephone', e.target.value)} placeholder="+225 20 00 00 00" />
        </FormRow>
      </FormGrid>
      <FormGrid>
        <FormRow label="Email">
          <input className="input text-sm" type="email" value={f.email} onChange={e => s('email', e.target.value)} placeholder="contact@fournisseur.com" />
        </FormRow>
        <FormRow label="Pays">
          <input className="input text-sm" value={f.pays} onChange={e => s('pays', e.target.value)} />
        </FormRow>
      </FormGrid>
      <FormRow label="Adresse">
        <input className="input text-sm" value={f.adresse} onChange={e => s('adresse', e.target.value)} placeholder="Adresse complète" />
      </FormRow>
      <FormRow label="Conditions commerciales">
        <textarea className="input text-sm resize-none" rows={2} value={f.conditions} onChange={e => s('conditions', e.target.value)} placeholder="Ex: 30% à la commande, solde à 30j..." />
      </FormRow>
    </>
  );

  return (
    <>
      <PageHeader title="Fournisseurs" subtitle="Gestion des partenaires"
        action={<button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau fournisseur</button>} />

      <div className="p-4 sm:p-6">
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['','Fournisseur','Pays','Total achats','Encours dette','Délai paiement','Contact','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(frs ?? []).map(f => (
                    <React.Fragment key={f.id}>
                    <tr
                      className={`border-b border-black/[0.04] hover:bg-[#F8F7F4] cursor-pointer ${expandedId === f.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleExpand(f)}>
                      <td className="px-3 py-2.5 text-[#A8A49E] text-center w-6">
                        <span className="text-[10px]">{expandedId === f.id ? '▼' : '▶'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{f.raison_sociale}</div>
                        <div className="font-mono text-[10px] text-[#A8A49E]">{f.email ?? ''}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{f.pays ?? 'CI'}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(f.total_achats)}</td>
                      <td className="px-4 py-2.5 font-mono">
                        <span className={(f.encours_dette ?? 0) > 0 ? 'text-red-600 font-medium' : ''}>
                          {fcfa(f.encours_dette)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{f.delai_paiement} j</td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{f.telephone ?? '—'}</td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(f)}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                            Modifier
                          </button>
                          <button onClick={() => handleDelete(f)}
                            className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                            Désactiver
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === f.id && (
                      <tr key={`expand-${f.id}`} className="bg-blue-50/30">
                        <td colSpan={8} className="px-8 py-3">
                          {expandLoad[f.id] ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                          ) : (
                            <div>
                              <div className="text-[11px] font-mono text-[#6B6862] uppercase mb-2">
                                Historique achats — {f.raison_sociale}
                              </div>
                              {(expandData[f.id] ?? []).length === 0 ? (
                                <div className="text-[11px] text-[#A8A49E] py-2">Aucun achat enregistré</div>
                              ) : (
                                <table className="w-full text-xs border border-black/[0.08] rounded-lg overflow-hidden">
                                  <thead className="bg-white">
                                    <tr>
                                      {['N°','Date','Montant TTC','Payé','Solde','Statut'].map(h => (
                                        <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandData[f.id] ?? []).map(a => (
                                      <tr key={a.id} className="border-t border-black/[0.06]">
                                        <td className="px-3 py-1.5 font-mono text-[10px] text-[#6B6862]">{a.numero}</td>
                                        <td className="px-3 py-1.5 font-mono">{fdate(a.date_achat)}</td>
                                        <td className="px-3 py-1.5 font-mono">{fcfa(+a.total_ttc)}</td>
                                        <td className="px-3 py-1.5 font-mono text-green-700">{fcfa(+a.montant_paye)}</td>
                                        <td className="px-3 py-1.5 font-mono">
                                          <span className={+a.solde_restant > 0 ? 'text-red-600' : ''}>{fcfa(+a.solde_restant)}</span>
                                        </td>
                                        <td className="px-3 py-1.5"><Badge statut={a.statut_paiement} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>))}
                  {(frs ?? []).length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun fournisseur</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau fournisseur" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFields f={form} s={set} />
          <FormFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Créer le fournisseur" />
        </form>
      </Modal>

      {/* Modal édition */}
      <Modal open={!!editFrs} onClose={() => setEditFrs(null)} title="Modifier le fournisseur" size="lg">
        {editFrs && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormFields f={editForm} s={setEdit} />
            <FormFooter onCancel={() => setEditFrs(null)} loading={editSaving} submitLabel="Enregistrer les modifications" />
          </form>
        )}
      </Modal>
    </>
  );
}
