import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Client, Vente } from '@storebox/shared';
import { fcfa, fdate } from '../lib/formatters';
import { api } from '../lib/api';
import { exportCsv, CSV_CLIENTS } from '../lib/csv';
import { GrandLivreModal } from '../components/GrandLivreModal';

const VIDE = {
  code: '', type_client: 'grossiste', raison_sociale: '', contact_nom: '',
  telephone: '', email: '', adresse: '', ville: 'Abidjan',
  plafond_credit: '', delai_paiement: '0', solde_initial: '0',
};

export default function ClientsPage() {
  const { data: clients = [], loading, refresh } = useApi<Client[]>('/clients');
  const [search, setSearch] = useState('');
  const [type,   setType]   = useState('');
  const [statut, setStatut] = useState('');

  // Création
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({ ...VIDE });

  // Édition
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm,   setEditForm]   = useState({ ...VIDE, statut: 'actif' });
  const [editSaving, setEditSaving] = useState(false);

  // Grand livre
  const [grandLivre, setGrandLivre] = useState<{ id: number; nom: string } | null>(null);

  // Expand
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandData, setExpandData] = useState<Record<number, Vente[]>>({});
  const [expandLoad, setExpandLoad] = useState<Record<number, boolean>>({});

  const set     = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/clients', {
      ...form,
      plafond_credit: Number(form.plafond_credit) || 0,
      delai_paiement: Number(form.delai_paiement) || 0,
      solde_initial:  Number(form.solde_initial)  || 0,
    });
    setSaving(false);
    if (res.success) {
      toast('Client créé avec succès', 'success');
      setOpen(false);
      setForm({ ...VIDE });
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditForm({
      code:           c.code,
      type_client:    c.type_client,
      raison_sociale: c.raison_sociale,
      contact_nom:    c.contact_nom  ?? '',
      telephone:      c.telephone    ?? '',
      email:          c.email        ?? '',
      adresse:        c.adresse      ?? '',
      ville:          c.ville        ?? 'Abidjan',
      plafond_credit: String(c.plafond_credit ?? 0),
      delai_paiement: String(c.delai_paiement ?? 0),
      solde_initial:  String(c.solde_initial  ?? 0),
      statut:         c.statut,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    setEditSaving(true);
    const res = await api.put(`/clients/${editClient.id}`, {
      ...editForm,
      plafond_credit: Number(editForm.plafond_credit) || 0,
      delai_paiement: Number(editForm.delai_paiement) || 0,
      solde_initial:  Number(editForm.solde_initial)  || 0,
    });
    setEditSaving(false);
    if (res.success) {
      toast('Client modifié', 'success');
      setEditClient(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (c: Client) => {
    if (!confirm(`Désactiver le client "${c.raison_sociale}" ?`)) return;
    const res = await api.delete(`/clients/${c.id}`);
    if (res.success) { toast('Client désactivé', 'success'); refresh(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  const toggleExpand = async (c: Client) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    if (expandData[c.id]) return;
    setExpandLoad(l => ({ ...l, [c.id]: true }));
    const res = await api.get<Vente[]>(`/ventes?client_id=${c.id}`);
    setExpandLoad(l => ({ ...l, [c.id]: false }));
    if (res.success) setExpandData(d => ({ ...d, [c.id]: res.data ?? [] }));
  };

  const filtered = (clients ?? []).filter(c => {
    if (search && !c.raison_sociale.toLowerCase().includes(search.toLowerCase())) return false;
    if (type   && c.type_client !== type)   return false;
    if (statut && c.statut     !== statut)  return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Clients" subtitle="CRM — Gros, détail, particuliers"
        action={
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={() => exportCsv(clients as unknown as Record<string,unknown>[], CSV_CLIENTS, `clients-${new Date().toISOString().slice(0,10)}`)}>↓ CSV</button>
            <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau client</button>
          </div>
        } />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 min-w-0 text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none"
            placeholder="Rechercher client…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="w-full sm:w-auto text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono"
            value={type} onChange={e => setType(e.target.value)}>
            <option value="">Tous types</option>
            <option value="grossiste">Grossiste</option>
            <option value="detaillant">Détaillant</option>
            <option value="particulier">Particulier</option>
          </select>
          <select className="w-full sm:w-auto text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono"
            value={statut} onChange={e => setStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="bloque">Bloqué</option>
            <option value="contentieux">Contentieux</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['','Client','Type','CA total','Encours créance','Dernière vente','Statut','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <React.Fragment key={c.id}>
                    <tr className={`border-b border-black/[0.04] hover:bg-[#F8F7F4] cursor-pointer ${expandedId === c.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleExpand(c)}>
                      <td className="px-3 py-2.5 text-[#A8A49E] text-center w-6">
                        <span className="text-[10px]">{expandedId === c.id ? '▼' : '▶'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{c.raison_sociale}</div>
                        <div className="font-mono text-[10px] text-[#A8A49E]">{c.telephone ?? ''}</div>
                      </td>
                      <td className="px-4 py-2.5"><Badge statut={c.type_client} /></td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(c.ca_total)}</td>
                      <td className="px-4 py-2.5 font-mono">
                        <span className={(c.encours_creance ?? 0) > 0 ? 'text-red-600' : ''}>{fcfa(c.encours_creance)}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(c.derniere_vente)}</td>
                      <td className="px-4 py-2.5"><Badge statut={c.statut} /></td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setGrandLivre({ id: c.id, nom: c.raison_sociale })}
                            className="btn text-[10px] px-2 py-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                            Grand livre
                          </button>
                          <button onClick={() => openEdit(c)}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                            Modifier
                          </button>
                          <button onClick={() => handleDelete(c)}
                            className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                            Désactiver
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === c.id && (
                      <tr key={`expand-${c.id}`} className="bg-blue-50/30">
                        <td colSpan={8} className="px-8 py-3">
                          {expandLoad[c.id] ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                          ) : (
                            <div>
                              <div className="text-[11px] font-mono text-[#6B6862] uppercase mb-2">
                                Historique des ventes — {c.raison_sociale}
                              </div>
                              {(expandData[c.id] ?? []).length === 0 ? (
                                <div className="text-[11px] text-[#A8A49E] py-2">Aucune vente enregistrée</div>
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
                                    {(expandData[c.id] ?? []).map(v => (
                                      <tr key={v.id} className="border-t border-black/[0.06]">
                                        <td className="px-3 py-1.5 font-mono text-[10px] text-[#6B6862]">{v.numero}</td>
                                        <td className="px-3 py-1.5 font-mono">{fdate(v.date_vente)}</td>
                                        <td className="px-3 py-1.5 font-mono">{fcfa(+v.total_ttc)}</td>
                                        <td className="px-3 py-1.5 font-mono text-green-700">{fcfa(+v.montant_paye)}</td>
                                        <td className="px-3 py-1.5 font-mono">
                                          <span className={+v.solde_restant > 0 ? 'text-red-600' : ''}>{fcfa(+v.solde_restant)}</span>
                                        </td>
                                        <td className="px-3 py-1.5"><Badge statut={v.statut_paiement} /></td>
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
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun client</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau client" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGrid>
            <FormRow label="Type de client" required>
              <select className="input text-sm" value={form.type_client} onChange={e => set('type_client', e.target.value)}>
                <option value="grossiste">Grossiste</option>
                <option value="detaillant">Détaillant</option>
                <option value="particulier">Particulier</option>
              </select>
            </FormRow>
          </FormGrid>
          <FormRow label="Raison sociale / Nom" required>
            <input className="input text-sm" value={form.raison_sociale} onChange={e => set('raison_sociale', e.target.value)} required placeholder="Nom du client" />
          </FormRow>
          <FormGrid>
            <FormRow label="Contact">
              <input className="input text-sm" value={form.contact_nom} onChange={e => set('contact_nom', e.target.value)} placeholder="Nom du contact" />
            </FormRow>
            <FormRow label="Téléphone">
              <input className="input text-sm" value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+225 07 00 00 00" />
            </FormRow>
          </FormGrid>
          <FormGrid>
            <FormRow label="Email">
              <input className="input text-sm" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemple.ci" />
            </FormRow>
            <FormRow label="Ville">
              <input className="input text-sm" value={form.ville} onChange={e => set('ville', e.target.value)} placeholder="Abidjan" />
            </FormRow>
          </FormGrid>
          <FormRow label="Adresse">
            <input className="input text-sm" value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Adresse complète" />
          </FormRow>
          <FormGrid>
            <FormRow label="Plafond crédit (FCFA)">
              <input className="input text-sm font-mono" type="number" min="0" value={form.plafond_credit} onChange={e => set('plafond_credit', e.target.value)} placeholder="0" />
            </FormRow>
            <FormRow label="Délai paiement (jours)">
              <input className="input text-sm font-mono" type="number" min="0" value={form.delai_paiement} onChange={e => set('delai_paiement', e.target.value)} placeholder="0" />
            </FormRow>
          </FormGrid>
          <FormRow label="Solde initial (FCFA)">
            <input className="input text-sm font-mono" type="number" min="0" value={form.solde_initial} onChange={e => set('solde_initial', e.target.value)} placeholder="0" />
          </FormRow>
          <FormFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Créer le client" />
        </form>
      </Modal>

      {/* Modal édition */}
      <Modal open={!!editClient} onClose={() => setEditClient(null)} title="Modifier le client" size="lg">
        {editClient && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormGrid>
              <FormRow label="Type de client" required>
                <select className="input text-sm" value={editForm.type_client} onChange={e => setEdit('type_client', e.target.value)}>
                  <option value="grossiste">Grossiste</option>
                  <option value="detaillant">Détaillant</option>
                  <option value="particulier">Particulier</option>
                </select>
              </FormRow>
              <FormRow label="Statut">
                <select className="input text-sm" value={editForm.statut} onChange={e => setEdit('statut', e.target.value)}>
                  <option value="actif">Actif</option>
                  <option value="bloque">Bloqué</option>
                  <option value="contentieux">Contentieux</option>
                  <option value="inactif">Inactif</option>
                </select>
              </FormRow>
            </FormGrid>
            <FormRow label="Raison sociale / Nom" required>
              <input className="input text-sm" value={editForm.raison_sociale} onChange={e => setEdit('raison_sociale', e.target.value)} required />
            </FormRow>
            <FormGrid>
              <FormRow label="Contact">
                <input className="input text-sm" value={editForm.contact_nom} onChange={e => setEdit('contact_nom', e.target.value)} />
              </FormRow>
              <FormRow label="Téléphone">
                <input className="input text-sm" value={editForm.telephone} onChange={e => setEdit('telephone', e.target.value)} />
              </FormRow>
            </FormGrid>
            <FormGrid>
              <FormRow label="Email">
                <input className="input text-sm" type="email" value={editForm.email} onChange={e => setEdit('email', e.target.value)} />
              </FormRow>
              <FormRow label="Ville">
                <input className="input text-sm" value={editForm.ville} onChange={e => setEdit('ville', e.target.value)} />
              </FormRow>
            </FormGrid>
            <FormGrid>
              <FormRow label="Plafond crédit (FCFA)">
                <input className="input text-sm font-mono" type="number" min="0" value={editForm.plafond_credit} onChange={e => setEdit('plafond_credit', e.target.value)} />
              </FormRow>
              <FormRow label="Délai paiement (jours)">
                <input className="input text-sm font-mono" type="number" min="0" value={editForm.delai_paiement} onChange={e => setEdit('delai_paiement', e.target.value)} />
              </FormRow>
            </FormGrid>
            <FormRow label="Solde initial (FCFA)">
              <input className="input text-sm font-mono" type="number" min="0" value={editForm.solde_initial} onChange={e => setEdit('solde_initial', e.target.value)} />
            </FormRow>
            <FormFooter onCancel={() => setEditClient(null)} loading={editSaving} submitLabel="Enregistrer les modifications" />
          </form>
        )}
      </Modal>

      {grandLivre && (
        <GrandLivreModal clientId={grandLivre.id} clientNom={grandLivre.nom} onClose={() => setGrandLivre(null)} />
      )}
    </>
  );
}
