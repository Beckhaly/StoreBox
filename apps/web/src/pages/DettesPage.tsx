import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { Dette } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface DettesData { dettes: Dette[]; total: { total: number; echu: number; urgent: number }; }
interface Referentiels { moyens_paiement: {id:number;nom:string}[]; }

export default function DettesPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/dettes${qs ? `?${qs}` : ''}`;
  }, [dateDebut, dateFin]);

  const { data, loading, refresh } = useApi<DettesData>(path);
  const { data: refs } = useApi<Referentiels>('/referentiels');
  const t = data?.total;

  const [reglementDette, setReglementDette] = useState<Dette | null>(null);
  const [montant,   setMontant]   = useState('');
  const [moyen,     setMoyen]     = useState('');
  const [reference, setReference] = useState('');
  const [saving,    setSaving]    = useState(false);

  const handleRegler = (d: Dette) => {
    setMontant(String(d.solde_restant));
    setMoyen('');
    setReference('');
    setReglementDette(d);
  };

  const handleReglementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reglementDette) return;
    setSaving(true);
    const res = await api.post('/paiements', {
      type_paiement:    'decaissement',
      achat_id:         reglementDette.id,
      montant:          Number(montant),
      date_paiement:    new Date().toISOString().slice(0, 10),
      moyen_paiement_id: moyen ? Number(moyen) : null,
      reference:        reference || null,
    });
    setSaving(false);
    if (res.success) {
      toast(`Paiement de ${fcfa(Number(montant))} enregistré`, 'success');
      setReglementDette(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors du paiement', 'error');
    }
  };

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); };
  const hasFilters = dateDebut || dateFin;

  return (
    <>
      <PageHeader title="Dettes fournisseurs" subtitle="Encours & échéances de paiement" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL DÛ',          value: fcfaM(t?.total),  cls: '' },
            { label: 'ÉCHU — À PAYER',    value: fcfaM(t?.echu),   cls: 'text-red-600' },
            { label: 'ÉCHÉANCE <15J',     value: fcfaM(t?.urgent), cls: 'text-amber-600' },
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
                    {['Fournisseur','Facture','Montant','Échéance','Retard','Reste dû','Statut','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.dettes ?? []).map(d => (
                    <tr key={d.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5 font-medium">{d.raison_sociale}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-[#6B6862]">{d.numero}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(+d.total_ttc)}</td>
                      <td className="px-4 py-2.5 font-mono">{fdate(d.date_echeance)}</td>
                      <td className="px-4 py-2.5">
                        {(d.jours_retard ?? 0) > 0
                          ? <span className="text-red-600 font-medium">{d.jours_retard}j</span>
                          : <span className="text-[#A8A49E]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-red-600 font-medium">{fcfa(+d.solde_restant)}</td>
                      <td className="px-4 py-2.5"><Badge statut={d.categorie_echeance} /></td>
                      <td className="px-4 py-2.5">
                        {+d.solde_restant > 0 && (
                          <button onClick={() => handleRegler(d)}
                            className="btn text-[10px] px-2 py-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                            Payer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(data?.dettes ?? []).length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucune dette</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal règlement dette */}
      <Modal open={!!reglementDette} onClose={() => setReglementDette(null)} title="Payer une dette fournisseur" size="sm">
        {reglementDette && (
          <form onSubmit={handleReglementSubmit} className="space-y-4">
            <div className="bg-[#F8F7F4] rounded-lg p-3 text-sm space-y-1">
              <div className="font-medium">{reglementDette.raison_sociale}</div>
              <div className="font-mono text-[11px] text-[#6B6862]">{reglementDette.numero}</div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-[#6B6862]">Solde à payer</span>
                <span className="font-mono font-semibold text-red-600">{fcfa(+reglementDette.solde_restant)}</span>
              </div>
            </div>

            <FormRow label="Montant payé (FCFA)" required>
              <input className="input text-sm font-mono" type="number" min="1" max={+reglementDette.solde_restant}
                value={montant} onChange={e => setMontant(e.target.value)} required />
            </FormRow>

            <FormRow label="Moyen de paiement">
              <select className="input text-sm" value={moyen} onChange={e => setMoyen(e.target.value)}>
                <option value="">— Choisir —</option>
                {(refs?.moyens_paiement ?? []).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </FormRow>

            <FormRow label="Référence (N° chèque, transaction…)">
              <input className="input text-sm font-mono" value={reference} onChange={e => setReference(e.target.value)} placeholder="REF-2026-001" />
            </FormRow>

            <FormFooter onCancel={() => setReglementDette(null)} loading={saving} submitLabel="Valider le paiement" />
          </form>
        )}
      </Modal>
    </>
  );
}
