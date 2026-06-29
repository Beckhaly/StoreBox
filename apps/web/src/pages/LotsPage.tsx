import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Lot, Produit } from '@storebox/shared';
import { fdate } from '../lib/formatters';
import { api } from '../lib/api';

const VIDE = { produit_id: '', numero_lot: '', date_peremption: '', quantite: '', prix_achat: '' };

// Couleur selon l'urgence de péremption
function urgence(j?: number): { cls: string; label: string } {
  if (j == null)            return { cls: 'bg-gray-100 text-gray-500', label: '—' };
  if (j < 0)                return { cls: 'bg-red-100 text-red-700',    label: `Périmé +${Math.abs(j)}j` };
  if (j === 0)              return { cls: 'bg-red-50 text-red-600',     label: "Aujourd'hui" };
  if (j <= 3)               return { cls: 'bg-orange-50 text-orange-700', label: `${j}j` };
  if (j <= 7)               return { cls: 'bg-amber-50 text-amber-700',  label: `${j}j` };
  return { cls: 'bg-green-50 text-green-700', label: `${j}j` };
}

export default function LotsPage() {
  const { data: lots = [], loading, refresh } = useApi<Lot[]>('/stock/lots');
  const { data: produits = [] }               = useApi<Produit[]>('/produits');

  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [form,   setForm]   = useState({ ...VIDE });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const stats = useMemo(() => {
    const arr = lots ?? [];
    return {
      total:   arr.length,
      perimes: arr.filter(l => (l.jours_restants ?? 99) < 0).length,
      sous7j:  arr.filter(l => (l.jours_restants ?? 99) >= 0 && (l.jours_restants ?? 99) <= 7).length,
    };
  }, [lots]);

  const creer = async () => {
    if (!form.produit_id)       { toast('Sélectionnez un produit', 'error'); return; }
    if (!form.quantite || +form.quantite <= 0) { toast('Quantité invalide', 'error'); return; }
    setSaving(true);
    const res = await api.post('/stock/lots', {
      produit_id:      +form.produit_id,
      numero_lot:      form.numero_lot.trim() || null,
      date_peremption: form.date_peremption || null,
      quantite:        +form.quantite,
      prix_achat:      +form.prix_achat || 0,
    });
    setSaving(false);
    if (res.success) {
      toast('Lot créé et stock mis à jour', 'success');
      setOpen(false); setForm({ ...VIDE }); refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const envoyerAlerte = async () => {
    setAlerting(true);
    const res = await api.post<{ lots: number; envoye: boolean }>('/stock/alertes-expiration?jours=7', {});
    setAlerting(false);
    if (res.success) {
      toast(res.data?.lots ? `Alerte envoyée — ${res.data.lots} lot(s) signalé(s)` : 'Aucun lot à signaler', 'success');
    } else {
      toast(res.error ?? 'Échec de l\'alerte', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Lots & Péremption"
        subtitle="Suivi des dates de péremption (FIFO)"
        action={
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs" onClick={envoyerAlerte} disabled={alerting}>
              {alerting ? '…' : '⏳ Alerte péremption'}
            </button>
            <button className="btn btn-primary text-xs" onClick={() => setOpen(true)}>
              + Nouveau lot
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-[#6B6862]">Lots actifs</div></div>
          <div className="card p-4"><div className="text-2xl font-bold text-amber-600">{stats.sous7j}</div><div className="text-xs text-[#6B6862]">À écouler ≤ 7j</div></div>
          <div className="card p-4"><div className="text-2xl font-bold text-red-600">{stats.perimes}</div><div className="text-xs text-[#6B6862]">Périmés</div></div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center"><Spinner /></div>
          ) : !lots || lots.length === 0 ? (
            <div className="p-10 text-center text-[#6B6862] text-sm">Aucun lot enregistré.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F5F3EF] text-[#6B6862] text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Produit</th>
                  <th className="px-4 py-2.5 text-left">N° lot</th>
                  <th className="px-4 py-2.5 text-left">Magasin</th>
                  <th className="px-4 py-2.5 text-left">Péremption</th>
                  <th className="px-4 py-2.5 text-center">Échéance</th>
                  <th className="px-4 py-2.5 text-right">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {[...lots].sort((a, b) => (a.jours_restants ?? 99) - (b.jours_restants ?? 99)).map(l => {
                  const u = urgence(l.jours_restants);
                  return (
                    <tr key={l.id} className="border-t border-[#EFEDE8]">
                      <td className="px-4 py-2.5 font-medium text-[#1A1917]">{l.designation ?? `#${l.produit_id}`}</td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{l.numero_lot ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{l.magasin_nom ?? '—'}</td>
                      <td className="px-4 py-2.5">{l.date_peremption ? fdate(l.date_peremption) : '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.cls}`}>{u.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{l.quantite}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal création */}
      <Modal open={open} onClose={() => { setOpen(false); setForm({ ...VIDE }); }} title="Nouveau lot (réception)">
        <form onSubmit={e => { e.preventDefault(); creer(); }}>
          <FormRow label="Produit" required>
            <select className="input text-sm" value={form.produit_id} onChange={e => set('produit_id', e.target.value)}>
              <option value="">— Sélectionner —</option>
              {(produits ?? []).map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
            </select>
          </FormRow>
          <FormGrid>
            <FormRow label="N° de lot">
              <input className="input text-sm font-mono" value={form.numero_lot} onChange={e => set('numero_lot', e.target.value)} placeholder="LOT-2026-001" />
            </FormRow>
            <FormRow label="Date de péremption">
              <input className="input text-sm" type="date" value={form.date_peremption} onChange={e => set('date_peremption', e.target.value)} />
            </FormRow>
          </FormGrid>
          <FormGrid>
            <FormRow label="Quantité" required>
              <input className="input text-sm font-mono" type="number" min="0" step="0.001" value={form.quantite} onChange={e => set('quantite', e.target.value)} />
            </FormRow>
            <FormRow label="Prix d'achat (F)">
              <input className="input text-sm font-mono" type="number" min="0" value={form.prix_achat} onChange={e => set('prix_achat', e.target.value)} />
            </FormRow>
          </FormGrid>
          <FormFooter onCancel={() => { setOpen(false); setForm({ ...VIDE }); }} loading={saving} submitLabel="Créer le lot" />
        </form>
      </Modal>
    </>
  );
}
