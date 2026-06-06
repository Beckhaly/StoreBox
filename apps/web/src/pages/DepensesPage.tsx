import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { exportCsv, CSV_DEPENSES } from '../lib/csv';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Depense {
  id: number;
  montant: number;
  date_paiement: string;
  categorie_depense: string;
  moyen_paiement: string | null;
  moyen_paiement_id: number | null;
  reference: string | null;
  notes: string | null;
  recurrence: string | null;
}

interface DepensesData {
  depenses: Depense[];
  kpi: { total_mois: string; nb_depenses: string; total_mois_courant: string };
  parCategorie: { categorie_depense: string; total: string; nb: string }[];
  evolution: { mois: string; total: string }[];
}

interface CategorieDepense { id: number; libelle: string }
interface Referentiels { moyens_paiement: { id: number; nom: string }[] }

const PIE_COLORS = ['#1B5FD6', '#1A7A4A', '#C47B0A', '#D93025', '#7B61FF', '#888780', '#2DB5A0', '#E8590C', '#6366F1', '#94A3B8'];
const RECURRENCES = [
  { value: '', label: 'Aucune' },
  { value: 'mensuelle', label: 'Mensuelle' },
  { value: 'trimestrielle', label: 'Trimestrielle' },
  { value: 'annuelle', label: 'Annuelle' },
];

type Tab = 'depenses' | 'categories';

// ── Form fields (extracted to avoid focus loss) ──
function DepenseFormFields({ form, setField, categories, refs }: {
  form: { montant: string; date: string; categorie: string; moyen: string; reference: string; notes: string; recurrence: string };
  setField: (k: string, v: string) => void;
  categories: CategorieDepense[];
  refs: Referentiels | null;
}) {
  return (
    <>
      <FormGrid>
        <FormRow label="Montant (FCFA)" required>
          <input className="input text-sm font-mono" type="number" min="1"
            value={form.montant} onChange={e => setField('montant', e.target.value)} required placeholder="350000" />
        </FormRow>
        <FormRow label="Date">
          <input className="input text-sm font-mono" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
        </FormRow>
      </FormGrid>

      <FormGrid>
        <FormRow label="Catégorie" required>
          <select className="input text-sm" value={form.categorie} onChange={e => setField('categorie', e.target.value)} required>
            <option value="">— Choisir —</option>
            {categories.map(c => <option key={c.id} value={c.libelle}>{c.libelle}</option>)}
          </select>
        </FormRow>
        <FormRow label="Moyen de paiement">
          <select className="input text-sm" value={form.moyen} onChange={e => setField('moyen', e.target.value)}>
            <option value="">— Choisir —</option>
            {(refs?.moyens_paiement ?? []).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </FormRow>
      </FormGrid>

      <FormRow label="Référence">
        <input className="input text-sm font-mono" value={form.reference} onChange={e => setField('reference', e.target.value)} placeholder="N° reçu, facture..." />
      </FormRow>

      <FormRow label="Notes">
        <textarea className="input text-sm" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Description de la dépense..." />
      </FormRow>

      <FormRow label="Récurrence">
        <select className="input text-sm" value={form.recurrence} onChange={e => setField('recurrence', e.target.value)}>
          {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </FormRow>
    </>
  );
}

const VIDE_FORM = { montant: '', date: new Date().toISOString().slice(0, 10), categorie: '', moyen: '', reference: '', notes: '', recurrence: '' };

export default function DepensesPage() {
  const [tab, setTab] = useState<Tab>('depenses');

  // ── Filtres ──
  const [filtre, setFiltre] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (filtre) p.set('categorie', filtre);
    if (dateDebut) p.set('debut', dateDebut);
    if (dateFin) p.set('fin', dateFin);
    const qs = p.toString();
    return `/depenses${qs ? `?${qs}` : ''}`;
  }, [filtre, dateDebut, dateFin]);

  const { data, loading, refresh } = useApi<DepensesData>(path);
  const { data: refs } = useApi<Referentiels>('/referentiels');

  const [categories, setCategories] = useState<CategorieDepense[]>([]);
  const chargerCategories = () => {
    api.get<CategorieDepense[]>('/depenses/categories').then(r => {
      if (r.success && r.data) setCategories(r.data);
    });
  };
  useEffect(() => { chargerCategories(); }, []);

  // ── Modal création ──
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...VIDE_FORM });
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── Modal édition ──
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...VIDE_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const setEditField = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  // ── Modal catégorie ──
  const [catOpen, setCatOpen] = useState(false);
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catLibelle, setCatLibelle] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // ── Generating recurring ──
  const [generating, setGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/depenses', {
      montant: Number(form.montant),
      date_paiement: form.date,
      categorie_depense: form.categorie,
      moyen_paiement_id: form.moyen ? Number(form.moyen) : null,
      reference: form.reference || null,
      notes: form.notes || null,
      recurrence: form.recurrence || null,
    });
    setSaving(false);
    if (res.success) {
      toast('Dépense enregistrée', 'success');
      setOpen(false);
      setForm({ ...VIDE_FORM });
      refresh();
    } else {
      toast(res.error ?? 'Erreur', 'error');
    }
  };

  const openEdit = (d: Depense) => {
    setEditId(d.id);
    setEditForm({
      montant: String(d.montant),
      date: d.date_paiement?.slice(0, 10) ?? '',
      categorie: d.categorie_depense ?? '',
      moyen: d.moyen_paiement_id ? String(d.moyen_paiement_id) : '',
      reference: d.reference ?? '',
      notes: d.notes ?? '',
      recurrence: d.recurrence ?? '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    const res = await api.put(`/depenses/${editId}`, {
      montant: Number(editForm.montant),
      date_paiement: editForm.date,
      categorie_depense: editForm.categorie,
      moyen_paiement_id: editForm.moyen ? Number(editForm.moyen) : null,
      reference: editForm.reference || null,
      notes: editForm.notes || null,
      recurrence: editForm.recurrence || null,
    });
    setEditSaving(false);
    if (res.success) {
      toast('Dépense modifiée', 'success');
      setEditId(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (d: Depense) => {
    if (!confirm(`Supprimer la dépense de ${fcfa(Number(d.montant))} ?`)) return;
    const res = await api.delete(`/depenses/${d.id}`);
    if (res.success) { toast('Dépense supprimée', 'success'); refresh(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  // ── Catégorie CRUD ──
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatSaving(true);
    const res = catEditId
      ? await api.put(`/depenses/categories/${catEditId}`, { libelle: catLibelle })
      : await api.post('/depenses/categories', { libelle: catLibelle });
    setCatSaving(false);
    if (res.success) {
      toast(catEditId ? 'Catégorie modifiée' : 'Catégorie créée', 'success');
      setCatOpen(false);
      setCatEditId(null);
      setCatLibelle('');
      chargerCategories();
    } else {
      toast(res.error ?? 'Erreur', 'error');
    }
  };

  const handleCatDelete = async (c: CategorieDepense) => {
    if (!confirm(`Désactiver la catégorie "${c.libelle}" ?`)) return;
    const res = await api.delete(`/depenses/categories/${c.id}`);
    if (res.success) { toast('Catégorie désactivée', 'success'); chargerCategories(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  const handleGenererRecurrentes = async () => {
    setGenerating(true);
    const res = await api.post<{ created: number; message: string }>('/depenses/generer-recurrentes', {});
    setGenerating(false);
    if (res.success && res.data) {
      toast(res.data.message, res.data.created > 0 ? 'success' : 'warn');
      if (res.data.created > 0) refresh();
    } else {
      toast(res.error ?? 'Erreur', 'error');
    }
  };

  const resetFiltres = () => { setFiltre(''); setDateDebut(''); setDateFin(''); };

  const totalMois = Number(data?.kpi?.total_mois_courant ?? 0);
  const nbDepenses = Number(data?.kpi?.nb_depenses ?? 0);
  const hasFilters = filtre || dateDebut || dateFin;

  return (
    <>
      <PageHeader
        title="Dépenses"
        subtitle="Suivi des charges et frais"
        action={
          <div className="flex items-center gap-2">
            {tab === 'depenses' && (
              <>
                <button className="btn text-xs" onClick={() => exportCsv(
                  (data?.depenses ?? []) as unknown as Record<string, unknown>[],
                  CSV_DEPENSES,
                  `depenses-${new Date().toISOString().slice(0, 10)}`
                )}>↓ CSV</button>
                <button className="btn text-xs" onClick={handleGenererRecurrentes} disabled={generating}>
                  {generating ? '...' : '⟳ Récurrentes'}
                </button>
                <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>
                  + Nouvelle dépense
                </button>
              </>
            )}
            {tab === 'categories' && (
              <button className="btn btn-primary text-xs" onClick={() => { setCatEditId(null); setCatLibelle(''); setCatOpen(true); }}>
                + Nouvelle catégorie
              </button>
            )}
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Onglets */}
        <div className="flex gap-1 border-b border-black/[0.08]">
          {([['depenses', 'Dépenses'], ['categories', 'Catégories']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-[#6B6862] hover:text-[#1A1917]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'depenses' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="metric-card">
                <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{hasFilters ? 'TOTAL PÉRIODE' : 'TOTAL DU MOIS'}</div>
                <div className="text-lg sm:text-[22px] font-light text-red-600">{fcfaM(totalMois)}</div>
              </div>
              <div className="metric-card">
                <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">NB DÉPENSES</div>
                <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">{nbDepenses}</div>
              </div>
              <div className="metric-card">
                <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">MOYENNE / DÉPENSE</div>
                <div className="text-lg sm:text-[22px] font-light text-[#1A1917]">
                  {nbDepenses > 0 ? fcfaM(totalMois / nbDepenses) : '—'}
                </div>
              </div>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Catégorie</label>
                <select value={filtre} onChange={e => setFiltre(e.target.value)}
                  className="text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none">
                  <option value="">Toutes</option>
                  {categories.map(c => <option key={c.id} value={c.libelle}>{c.libelle}</option>)}
                </select>
              </div>
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

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="text-[13px] font-medium mb-3">Répartition par catégorie</div>
                {(data?.parCategorie ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {(data?.parCategorie ?? []).map((c, i) => {
                      const pct = totalMois > 0 ? (Number(c.total) / totalMois) * 100 : 0;
                      return (
                        <div key={c.categorie_depense} className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs flex-1 truncate">{c.categorie_depense ?? 'Non classé'}</span>
                          <span className="text-xs font-mono font-medium">{fcfaM(Number(c.total))}</span>
                          <span className="text-[10px] font-mono text-[#A8A49E] w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-[#A8A49E] text-center py-6">Aucune dépense sur cette période</div>
                )}
              </div>

              <div className="card p-4">
                <div className="text-[13px] font-medium mb-3">Évolution (6 mois)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={(data?.evolution ?? []).map(e => ({ ...e, total: Number(e.total) }))} barSize={20}>
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#A8A49E' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#A8A49E' }} axisLine={false} tickLine={false}
                      tickFormatter={v => (v / 1e6).toFixed(1) + 'M'} />
                    <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="total" fill="#D93025" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div className="card">
              <div className="px-4 py-3 border-b border-black/[0.08] flex items-center justify-between">
                <span className="text-[13px] font-medium">
                  Détail des dépenses
                  <span className="text-[#A8A49E] font-normal ml-2">({(data?.depenses ?? []).length})</span>
                </span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.06]">
                        {['Date', 'Catégorie', 'Montant', 'Moyen', 'Référence', 'Notes', 'Réc.', 'Actions'].map(h => (
                          <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.depenses ?? []).map(d => (
                        <tr key={d.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                          <td className="px-4 py-2.5 font-mono">{fdate(d.date_paiement)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100">
                              {d.categorie_depense ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono font-medium text-red-600">{fcfa(Number(d.montant))}</td>
                          <td className="px-4 py-2.5 text-[#6B6862]">{d.moyen_paiement ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-[#6B6862]">{d.reference ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#6B6862] truncate max-w-[200px]">{d.notes ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            {d.recurrence ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-blue-50 text-blue-700">
                                {d.recurrence}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(d)}
                                className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                                Modifier
                              </button>
                              <button onClick={() => handleDelete(d)}
                                className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(data?.depenses ?? []).length === 0 && (
                        <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucune dépense</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Onglet Catégories ── */}
        {tab === 'categories' && (
          <div className="card">
            <div className="px-4 py-3 border-b border-black/[0.08]">
              <span className="text-[13px] font-medium">Catégories de dépenses</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['ID', 'Libellé', 'Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5 font-mono text-[#A8A49E]">{c.id}</td>
                      <td className="px-4 py-2.5 font-medium">{c.libelle}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setCatEditId(c.id); setCatLibelle(c.libelle); setCatOpen(true); }}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                            Modifier
                          </button>
                          <button onClick={() => handleCatDelete(c)}
                            className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                            Désactiver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-[#A8A49E] py-10">Aucune catégorie</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal création dépense */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle dépense" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DepenseFormFields form={form} setField={setField} categories={categories} refs={refs} />
          <FormFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Enregistrer la dépense" />
        </form>
      </Modal>

      {/* Modal édition dépense */}
      <Modal open={editId !== null} onClose={() => setEditId(null)} title="Modifier la dépense" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <DepenseFormFields form={editForm} setField={setEditField} categories={categories} refs={refs} />
          <FormFooter onCancel={() => setEditId(null)} loading={editSaving} submitLabel="Enregistrer les modifications" />
        </form>
      </Modal>

      {/* Modal catégorie */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title={catEditId ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="sm">
        <form onSubmit={handleCatSubmit} className="space-y-4">
          <FormRow label="Libellé" required>
            <input className="input text-sm" value={catLibelle} onChange={e => setCatLibelle(e.target.value)} required
              placeholder="Ex: Loyer & charges" />
          </FormRow>
          <FormFooter onCancel={() => setCatOpen(false)} loading={catSaving} submitLabel={catEditId ? 'Modifier' : 'Créer'} />
        </form>
      </Modal>
    </>
  );
}
