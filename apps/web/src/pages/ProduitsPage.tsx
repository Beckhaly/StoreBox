import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, StockBar, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Produit } from '@storebox/shared';
import { fcfa, fcfaM } from '../lib/formatters';
import { api } from '../lib/api';
import { exportCsv, CSV_PRODUITS } from '../lib/csv';

interface Referentiels {
  categories: {id:number;libelle:string}[];
  marques: {id:number;nom:string}[];
  unites_mesure?: {id:number;code:string;libelle:string;decimales:number}[];
}

const VIDE = {
  reference: '', designation: '', marque_id: '', categorie_id: '',
  prix_achat: '', prix_gros: '', prix_detail: '',
  qte_min_gros: '5', stock: '0', stock_alerte: '10', stock_max: '500',
  // Produits universels
  unite_id: '', vendu_au_poids: '', prix_modifiable: '',
  gere_peremption: '', gere_lot: '',
};

function FormFields({ f, s, refs }: { f: typeof VIDE; s: (k: string, v: string) => void; refs?: Referentiels | null }) {
  return (
    <>
      <FormGrid>
        <FormRow label="Référence" required>
          <input className="input text-sm font-mono" value={f.reference} onChange={e => s('reference', e.target.value)} required placeholder="SAM-A55-256" />
        </FormRow>
        <FormRow label="Marque">
          <select className="input text-sm" value={f.marque_id} onChange={e => s('marque_id', e.target.value)}>
            <option value="">— Sélectionner —</option>
            {(refs?.marques ?? []).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </FormRow>
      </FormGrid>
      <FormRow label="Désignation" required>
        <input className="input text-sm" value={f.designation} onChange={e => s('designation', e.target.value)} required placeholder="Samsung Galaxy A55 256Go" />
      </FormRow>
      <FormRow label="Catégorie">
        <select className="input text-sm" value={f.categorie_id} onChange={e => s('categorie_id', e.target.value)}>
          <option value="">— Sélectionner —</option>
          {(refs?.categories ?? []).map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
        </select>
      </FormRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormRow label="Prix achat (F)" required>
          <input className="input text-sm font-mono" type="number" min="0" value={f.prix_achat} onChange={e => s('prix_achat', e.target.value)} required placeholder="55000" />
        </FormRow>
        <FormRow label="Prix gros (F)" required>
          <input className="input text-sm font-mono" type="number" min="0" value={f.prix_gros} onChange={e => s('prix_gros', e.target.value)} required placeholder="65000" />
        </FormRow>
        <FormRow label="Prix détail (F)" required>
          <input className="input text-sm font-mono" type="number" min="0" value={f.prix_detail} onChange={e => s('prix_detail', e.target.value)} required placeholder="79000" />
        </FormRow>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="Seuil alerte">
          <input className="input text-sm font-mono" type="number" min="0" value={f.stock_alerte} onChange={e => s('stock_alerte', e.target.value)} />
        </FormRow>
        <FormRow label="Stock max">
          <input className="input text-sm font-mono" type="number" min="0" value={f.stock_max} onChange={e => s('stock_max', e.target.value)} />
        </FormRow>
        <FormRow label="Qté min gros">
          <input className="input text-sm font-mono" type="number" min="1" value={f.qte_min_gros} onChange={e => s('qte_min_gros', e.target.value)} />
        </FormRow>
      </div>

      {/* ─── Type de produit (unité & comportement) ─── */}
      <div className="mt-2 pt-3 border-t border-[#E7E4DE]">
        <p className="text-xs font-medium text-[#6B6862] mb-2">Type de produit</p>
        <FormRow label="Unité de mesure">
          <select className="input text-sm" value={f.unite_id} onChange={e => s('unite_id', e.target.value)}>
            <option value="">Pièce (par défaut)</option>
            {(refs?.unites_mesure ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.libelle} ({u.code})</option>
            ))}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.vendu_au_poids === '1'} onChange={e => s('vendu_au_poids', e.target.checked ? '1' : '')} />
            Vendu au poids/volume (quantité décimale)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.prix_modifiable === '1'} onChange={e => s('prix_modifiable', e.target.checked ? '1' : '')} />
            Prix saisi à la caisse (pesée)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.gere_peremption === '1'} onChange={e => s('gere_peremption', e.target.checked ? '1' : '')} />
            Gère la péremption (DLC)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.gere_lot === '1'} onChange={e => s('gere_lot', e.target.checked ? '1' : '')} />
            Gère les lots
          </label>
        </div>
      </div>
    </>
  );
}

export default function ProduitsPage() {
  const { data: produits = [], loading, refresh } = useApi<Produit[]>('/produits');
  const { data: refs } = useApi<Referentiels>('/referentiels');
  const [search, setSearch] = useState('');
  const [marque, setMarque] = useState('');
  const [alerte, setAlerte] = useState(false);

  // Création
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({ ...VIDE });

  // Édition
  const [editProduit, setEditProduit] = useState<Produit | null>(null);
  const [editForm,    setEditForm]    = useState({ ...VIDE });
  const [editSaving,  setEditSaving]  = useState(false);

  const set     = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const marques = useMemo(() =>
    [...new Set((produits ?? []).map(p => p.marque).filter(Boolean))].sort() as string[],
    [produits]
  );

  const filtered = useMemo(() => {
    let list = produits ?? [];
    if (search) list = list.filter(p => p.designation.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase()));
    if (marque) list = list.filter(p => p.marque === marque);
    if (alerte) list = list.filter(p => p.stock < p.stock_alerte);
    return list;
  }, [produits, search, marque, alerte]);

  const ruptures = (produits ?? []).filter(p => p.stock === 0).length;
  const alertes  = (produits ?? []).filter(p => p.stock > 0 && p.stock < p.stock_alerte).length;
  const valeur   = (produits ?? []).reduce((s, p) => s + p.stock * p.prix_achat, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/produits', {
      ...form,
      marque_id:    Number(form.marque_id)    || null,
      categorie_id: Number(form.categorie_id) || null,
      prix_achat:   Number(form.prix_achat),
      prix_gros:    Number(form.prix_gros),
      prix_detail:  Number(form.prix_detail),
      qte_min_gros: Number(form.qte_min_gros),
      stock:        Number(form.stock),
      stock_alerte: Number(form.stock_alerte),
      stock_max:    Number(form.stock_max),
      unite_id:        Number(form.unite_id) || null,
      vendu_au_poids:  form.vendu_au_poids  === '1',
      prix_modifiable: form.prix_modifiable === '1',
      gere_peremption: form.gere_peremption === '1',
      gere_lot:        form.gere_lot        === '1',
    });
    setSaving(false);
    if (res.success) {
      toast('Produit créé avec succès', 'success');
      setOpen(false);
      setForm({ ...VIDE });
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const openEdit = (p: Produit) => {
    setEditProduit(p);
    setEditForm({
      reference:    p.reference,
      designation:  p.designation,
      marque_id:    String(refs?.marques?.find(m => m.nom === p.marque)?.id ?? ''),
      categorie_id: String(refs?.categories?.find(c => c.libelle === p.categorie)?.id ?? ''),
      prix_achat:   String(p.prix_achat),
      prix_gros:    String(p.prix_gros),
      prix_detail:  String(p.prix_detail),
      qte_min_gros: String(p.qte_min_gros),
      stock:        String(p.stock),
      stock_alerte: String(p.stock_alerte),
      stock_max:    String(p.stock_max),
      unite_id:        String(p.unite_id ?? ''),
      vendu_au_poids:  p.vendu_au_poids  ? '1' : '',
      prix_modifiable: p.prix_modifiable ? '1' : '',
      gere_peremption: p.gere_peremption ? '1' : '',
      gere_lot:        p.gere_lot        ? '1' : '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduit) return;
    setEditSaving(true);
    const res = await api.put(`/produits/${editProduit.id}`, {
      reference:    editForm.reference,
      designation:  editForm.designation,
      marque_id:    Number(editForm.marque_id)    || null,
      categorie_id: Number(editForm.categorie_id) || null,
      prix_achat:   Number(editForm.prix_achat),
      prix_gros:    Number(editForm.prix_gros),
      prix_detail:  Number(editForm.prix_detail),
      qte_min_gros: Number(editForm.qte_min_gros),
      stock_alerte: Number(editForm.stock_alerte),
      stock_max:    Number(editForm.stock_max),
      unite_id:        Number(editForm.unite_id) || null,
      vendu_au_poids:  editForm.vendu_au_poids  === '1',
      prix_modifiable: editForm.prix_modifiable === '1',
      gere_peremption: editForm.gere_peremption === '1',
      gere_lot:        editForm.gere_lot        === '1',
    });
    setEditSaving(false);
    if (res.success) {
      toast('Produit modifié', 'success');
      setEditProduit(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (p: Produit) => {
    if (!confirm(`Désactiver le produit "${p.designation}" ?`)) return;
    const res = await api.delete(`/produits/${p.id}`);
    if (res.success) { toast('Produit désactivé', 'success'); refresh(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  return (
    <>
      <PageHeader title="Produits & stock" subtitle="Téléphones et accessoires"
        action={
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={() => exportCsv(produits as unknown as Record<string,unknown>[], CSV_PRODUITS, `produits-${new Date().toISOString().slice(0,10)}`)}>↓ CSV</button>
            <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>+ Nouveau produit</button>
          </div>
        } />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'RÉFÉRENCES ACTIVES', value: String((produits ?? []).length), cls: '' },
            { label: 'VALEUR DU STOCK',    value: fcfaM(valeur),                   cls: '' },
            { label: 'RUPTURES / ALERTES', value: `${ruptures} / ${alertes}`,      cls: 'text-red-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metric-card">
              <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
              <div className={`text-lg sm:text-[22px] font-light ${cls || 'text-[#1A1917]'}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 min-w-0 text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none"
            placeholder="Rechercher produit, référence…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="w-full sm:w-auto text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono"
            value={marque} onChange={e => setMarque(e.target.value)}>
            <option value="">Toutes marques</option>
            {marques.map(m => <option key={m}>{m}</option>)}
          </select>
          <button className={`btn text-xs ${alerte ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}`}
            onClick={() => setAlerte(v => !v)}>
            {alerte ? 'Alertes actives' : 'Filtrer alertes'}
          </button>
        </div>
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Désignation','Marque','Prix gros','Prix détail','Stock','Seuil','Niveau','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium truncate max-w-[200px]" title={p.designation}>{p.designation}</div>
                        <div className="font-mono text-[10px] text-[#A8A49E]">{p.reference}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{p.marque ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(p.prix_gros)}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(p.prix_detail)}</td>
                      <td className="px-4 py-2.5">
                        <span className={p.stock === 0 ? 'text-red-600 font-medium' : p.stock < p.stock_alerte ? 'text-amber-600 font-medium' : ''}>
                          {p.stock} u.
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{p.stock_alerte}</td>
                      <td className="px-4 py-2.5 w-36">
                        <StockBar stock={p.stock} alerte={p.stock_alerte} max={p.stock_max} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                            Modifier
                          </button>
                          <button onClick={() => handleDelete(p)}
                            className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                            Désactiver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucun produit</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau produit" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFields f={form} s={set} refs={refs} />
          <FormRow label="Stock initial">
            <input className="input text-sm font-mono" type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} />
          </FormRow>
          <FormFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Créer le produit" />
        </form>
      </Modal>

      {/* Modal édition */}
      <Modal open={!!editProduit} onClose={() => setEditProduit(null)} title="Modifier le produit" size="lg">
        {editProduit && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormFields f={editForm} s={setEdit} refs={refs} />
            <FormFooter onCancel={() => setEditProduit(null)} loading={editSaving} submitLabel="Enregistrer les modifications" />
          </form>
        )}
      </Modal>
    </>
  );
}
