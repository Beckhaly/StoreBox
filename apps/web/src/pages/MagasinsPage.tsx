import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Magasin } from '@storebox/shared';
import { fcfa } from '../lib/formatters';
import { api } from '../lib/api';

interface MagasinDetail extends Magasin {
  utilisateurs?: { id: number; code: string; nom: string; prenom: string; email: string; role: string }[];
  stock?: { reference: string; designation: string; quantite: number; prix_achat: number }[];
}

const VIDE = { code: '', nom: '', adresse: '', telephone: '', email: '' };
const VIDE_EDIT = { ...VIDE, actif: 'true' };

export default function MagasinsPage() {
  const { data: magasins, loading, refresh } = useApi<Magasin[]>('/magasins');

  // Création
  const [openCreate, setOpenCreate] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ ...VIDE });

  // Édition
  const [editMag,  setEditMag]  = useState<Magasin | null>(null);
  const [editForm, setEditForm] = useState({ ...VIDE_EDIT });
  const [editSaving, setEditSaving] = useState(false);

  // Détail (panel droit)
  const [detail,        setDetail]        = useState<MagasinDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const set     = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/magasins', {
      code: form.code, nom: form.nom,
      adresse: form.adresse || null,
      telephone: form.telephone || null,
      email: form.email || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Magasin créé', 'success');
      setOpenCreate(false); setForm({ ...VIDE }); refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const openEdit = (mg: Magasin) => {
    setEditMag(mg);
    setEditForm({
      code: mg.code, nom: mg.nom,
      adresse: mg.adresse ?? '',
      telephone: mg.telephone ?? '',
      email: mg.email ?? '',
      actif: mg.actif ? 'true' : 'false',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMag) return;
    setEditSaving(true);
    const res = await api.put(`/magasins/${editMag.id}`, {
      nom: editForm.nom,
      adresse: editForm.adresse || null,
      telephone: editForm.telephone || null,
      email: editForm.email || null,
      actif: editForm.actif === 'true',
    });
    setEditSaving(false);
    if (res.success) {
      toast('Magasin modifié', 'success');
      setEditMag(null);
      refresh();
      if (detail?.id === editMag.id) loadDetail(editMag.id);
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    const res = await api.get<MagasinDetail>(`/magasins/${id}`);
    setDetailLoading(false);
    if (res.success && res.data) setDetail(res.data);
  };

  const handleRowClick = (mg: Magasin) => {
    if (detail?.id === mg.id) { setDetail(null); return; }
    loadDetail(mg.id);
  };

  const list = magasins ?? [];

  return (
    <>
      <PageHeader
        title="Magasins"
        subtitle={`${list.length} magasin${list.length > 1 ? 's' : ''}`}
        action={<button className="btn btn-primary text-xs" onClick={() => setOpenCreate(true)}>+ Nouveau magasin</button>}
      />

      <div className="p-4 sm:p-6 flex gap-4 items-start">

        {/* ── Liste ── */}
        <div className="card overflow-hidden flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Code','Nom','Adresse','Téléphone','Utilisateurs','Valeur stock','Statut',''].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(mg => {
                    const isSelected = detail?.id === mg.id;
                    return (
                      <tr
                        key={mg.id}
                        onClick={() => handleRowClick(mg)}
                        className={`border-b border-black/[0.04] cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-[#F8F7F4]'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-[#6B6862]">{mg.code}</td>
                        <td className="px-4 py-2.5 font-medium">{mg.nom}</td>
                        <td className="px-4 py-2.5 text-[#6B6862]">{mg.adresse ?? <span className="text-[#C3BFB8]">—</span>}</td>
                        <td className="px-4 py-2.5 text-[#6B6862]">{mg.telephone ?? <span className="text-[#C3BFB8]">—</span>}</td>
                        <td className="px-4 py-2.5 text-center font-mono">{mg.nb_utilisateurs ?? 0}</td>
                        <td className="px-4 py-2.5 font-mono">{mg.valeur_stock != null ? fcfa(mg.valeur_stock) : <span className="text-[#C3BFB8]">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-mono text-[10px] ${mg.actif ? 'text-green-700' : 'text-[#A8A49E]'}`}>
                            {mg.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(mg)}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun magasin</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Panel détail ── */}
        {(detail || detailLoading) && (
          <div className="card w-72 flex-shrink-0 text-xs">
            <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
              <span className="font-medium text-sm">{detail?.nom ?? '…'}</span>
              <button onClick={() => setDetail(null)} className="text-[#A8A49E] hover:text-[#1A1917] transition-colors text-lg leading-none">×</button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : detail && (
              <div className="divide-y divide-black/[0.05]">
                {/* Infos */}
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#A8A49E]">Code</span>
                    <span className="font-mono">{detail.code}</span>
                  </div>
                  {detail.adresse && (
                    <div className="flex justify-between">
                      <span className="text-[#A8A49E]">Adresse</span>
                      <span className="text-right max-w-[140px]">{detail.adresse}</span>
                    </div>
                  )}
                  {detail.telephone && (
                    <div className="flex justify-between">
                      <span className="text-[#A8A49E]">Téléphone</span>
                      <span>{detail.telephone}</span>
                    </div>
                  )}
                  {detail.email && (
                    <div className="flex justify-between">
                      <span className="text-[#A8A49E]">Email</span>
                      <span className="truncate max-w-[140px]">{detail.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#A8A49E]">Statut</span>
                    <span className={detail.actif ? 'text-green-700' : 'text-[#A8A49E]'}>
                      {detail.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>

                {/* Utilisateurs */}
                {(detail.utilisateurs?.length ?? 0) > 0 && (
                  <div className="px-4 py-3">
                    <div className="font-mono text-[10px] text-[#A8A49E] uppercase mb-2">
                      Utilisateurs ({detail.utilisateurs!.length})
                    </div>
                    <div className="space-y-1.5">
                      {detail.utilisateurs!.map(u => (
                        <div key={u.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{u.prenom} {u.nom}</div>
                            <div className="text-[10px] text-[#A8A49E]">{u.email}</div>
                          </div>
                          <Badge statut={u.role} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock résumé */}
                {(detail.stock?.length ?? 0) > 0 && (
                  <div className="px-4 py-3">
                    <div className="font-mono text-[10px] text-[#A8A49E] uppercase mb-2">
                      Stock ({detail.stock!.length} références)
                    </div>
                    <div className="space-y-1">
                      {detail.stock!.slice(0, 8).map(s => (
                        <div key={s.reference} className="flex justify-between items-baseline">
                          <span className="truncate max-w-[150px] text-[#6B6862]">{s.designation}</span>
                          <span className="font-mono text-[10px] text-[#A8A49E] ml-1 flex-shrink-0">{s.quantite}</span>
                        </div>
                      ))}
                      {detail.stock!.length > 8 && (
                        <div className="text-[10px] text-[#A8A49E]">+ {detail.stock!.length - 8} autres</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal création */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nouveau magasin" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormRow label="Code" required>
            <input className="input text-sm font-mono" value={form.code} onChange={e => set('code', e.target.value)} required placeholder="MG-PLATEAU" />
          </FormRow>
          <FormRow label="Nom" required>
            <input className="input text-sm" value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="Boutique Plateau" />
          </FormRow>
          <FormRow label="Adresse">
            <input className="input text-sm" value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Rue du Commerce, Abidjan" />
          </FormRow>
          <FormGrid>
            <FormRow label="Téléphone">
              <input className="input text-sm" value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+225 07 00 00 00 00" />
            </FormRow>
            <FormRow label="Email">
              <input className="input text-sm" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@storebox.app" />
            </FormRow>
          </FormGrid>
          <FormFooter onCancel={() => setOpenCreate(false)} loading={saving} submitLabel="Créer le magasin" />
        </form>
      </Modal>

      {/* Modal édition */}
      <Modal open={!!editMag} onClose={() => setEditMag(null)} title="Modifier le magasin" size="sm">
        {editMag && (
          <form onSubmit={handleEdit} className="space-y-4">
            <FormRow label="Code">
              <input className="input text-sm font-mono bg-[#F8F7F4] cursor-not-allowed" value={editForm.code} readOnly />
            </FormRow>
            <FormRow label="Nom" required>
              <input className="input text-sm" value={editForm.nom} onChange={e => setEdit('nom', e.target.value)} required />
            </FormRow>
            <FormRow label="Adresse">
              <input className="input text-sm" value={editForm.adresse} onChange={e => setEdit('adresse', e.target.value)} />
            </FormRow>
            <FormGrid>
              <FormRow label="Téléphone">
                <input className="input text-sm" value={editForm.telephone} onChange={e => setEdit('telephone', e.target.value)} />
              </FormRow>
              <FormRow label="Email">
                <input className="input text-sm" type="email" value={editForm.email} onChange={e => setEdit('email', e.target.value)} />
              </FormRow>
            </FormGrid>
            <FormRow label="Statut">
              <select className="input text-sm" value={editForm.actif} onChange={e => setEdit('actif', e.target.value)}>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </FormRow>
            <FormFooter onCancel={() => setEditMag(null)} loading={editSaving} submitLabel="Enregistrer" />
          </form>
        )}
      </Modal>
    </>
  );
}
