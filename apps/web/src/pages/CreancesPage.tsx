import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, AgeingBar, toast } from '../components/ui';
import { Modal, FormRow, FormFooter } from '../components/ui/Modal';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { Creance, AgeingCreances } from '@storebox/shared';
import { fcfa, fcfaM, fdate } from '../lib/formatters';
import { exportCsv, CSV_CREANCES } from '../lib/csv';

type Filtre = '' | 'non_echu' | 'echu_30j' | 'echu_60j' | 'contentieux';

interface CreancesData { creances: Creance[]; ageing: AgeingCreances; }
interface Referentiels { moyens_paiement: {id:number;nom:string}[]; }

export default function CreancesPage() {
  const [filtre, setFiltre] = useState<Filtre>('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (filtre) p.set('categorie', filtre);
    if (dateDebut) p.set('date_debut', dateDebut);
    if (dateFin) p.set('date_fin', dateFin);
    const qs = p.toString();
    return `/creances${qs ? `?${qs}` : ''}`;
  }, [filtre, dateDebut, dateFin]);
  const { data, loading, refresh } = useApi<CreancesData>(path);
  const { data: refs } = useApi<Referentiels>('/referentiels');

  const [reglementCreance, setReglementCreance] = useState<Creance | null>(null);
  const [montant,   setMontant]   = useState('');
  const [moyen,     setMoyen]     = useState('');
  const [reference, setReference] = useState('');
  const [saving,    setSaving]    = useState(false);

  const ag = data?.ageing;

  const handleRelance = async (creance: Creance) => {
    if (!confirm(`Envoyer une relance SMS/WhatsApp à ${creance.raison_sociale} ?`)) return;
    const res = await api.post(`/notifications/relancer-creance/${creance.id}`, {});
    if (res.success) toast(`Relance envoyée à ${creance.raison_sociale}`, 'success');
    else toast(res.error ?? 'Erreur envoi', 'error');
  };

  const handlePDF = (creance: Creance) => api.openPdf(`/pdf/facture/${creance.id}`);

  const handleRegler = (creance: Creance) => {
    setMontant(String(creance.solde_restant));
    setMoyen('');
    setReference('');
    setReglementCreance(creance);
  };

  const handleReglementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reglementCreance) return;
    setSaving(true);
    const res = await api.post('/paiements', {
      type_paiement:    'encaissement',
      vente_id:         reglementCreance.id,
      montant:          Number(montant),
      date_paiement:    new Date().toISOString().slice(0, 10),
      moyen_paiement_id: moyen ? Number(moyen) : null,
      reference:        reference || null,
      envoyer_confirmation: true,
    });
    setSaving(false);
    if (res.success) {
      toast(`Règlement de ${fcfa(Number(montant))} enregistré`, 'success');
      setReglementCreance(null);
      refresh();
    } else {
      toast(res.error ?? 'Erreur lors du règlement', 'error');
    }
  };

  const resetFiltres = () => { setFiltre(''); setDateDebut(''); setDateFin(''); };
  const hasFilters = filtre || dateDebut || dateFin;

  return (
    <>
      <PageHeader
        title="Créances clients"
        subtitle="Suivi des encours et relances"
        action={
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={() => exportCsv((data?.creances ?? []) as unknown as Record<string,unknown>[], CSV_CREANCES, `creances-${new Date().toISOString().slice(0,10)}`)}>↓ CSV</button>
            <button className="btn btn-primary text-xs"
              onClick={() => api.post('/notifications/campagne-relances', {}).then(r => {
                if (r.success) toast(`Campagne lancée — ${(r.data as any)?.total ?? 0} relances`, 'success');
              })}>
              Campagne relances
            </button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL ENCOURS',           value: fcfaM(ag?.total),       cls: '' },
            { label: 'NON ÉCH.',                value: fcfaM(ag?.non_echu),    cls: 'text-green-700' },
            { label: 'ÉCHU ≤30J',               value: fcfaM(ag?.echu_30j),    cls: 'text-amber-600' },
            { label: 'ÉCHU >30J + CONTENTIEUX', value: fcfaM((ag?.echu_60j ?? 0) + (ag?.contentieux ?? 0)), cls: 'text-red-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metric-card">
              <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
              <div className={`text-lg sm:text-[22px] font-light leading-none ${cls || 'text-[#1A1917]'}`}>{value}</div>
            </div>
          ))}
        </div>

        {ag && (
          <div className="card p-4">
            <div className="text-[13px] font-medium mb-3">Ageing des créances</div>
            <AgeingBar {...ag} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Filtre ageing</label>
            <select value={filtre} onChange={e => setFiltre(e.target.value as Filtre)}
              className="text-xs font-mono px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none">
              <option value="">Toutes</option>
              <option value="non_echu">Non échu</option>
              <option value="echu_30j">Échu ≤30j</option>
              <option value="echu_60j">Échu ≤60j</option>
              <option value="contentieux">Contentieux</option>
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

        <div className="card">
          <div className="px-4 py-3 border-b border-black/[0.08]">
            <span className="text-[13px] font-medium">Détail des créances</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Client','Facture','Montant TTC','Solde','Échéance','Retard','Statut','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.creances ?? []).map(cr => (
                    <tr key={cr.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium truncate max-w-[160px]">{cr.raison_sociale}</div>
                        <div className="font-mono text-[10px] text-[#A8A49E]">{cr.type_client}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{cr.numero}</td>
                      <td className="px-4 py-2.5 font-mono">{fcfa(cr.total_ttc)}</td>
                      <td className="px-4 py-2.5 font-mono font-medium text-red-600">{fcfa(cr.solde_restant)}</td>
                      <td className="px-4 py-2.5 font-mono">{fdate(cr.date_echeance)}</td>
                      <td className="px-4 py-2.5">
                        {(cr.jours_retard ?? 0) > 0
                          ? <span className="text-red-600 font-medium">{cr.jours_retard}j</span>
                          : <span className="text-[#A8A49E]">—</span>}
                      </td>
                      <td className="px-4 py-2.5"><Badge statut={cr.categorie_echeance} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {cr.solde_restant > 0 && (
                            <button onClick={() => handleRegler(cr)}
                              className="btn text-[10px] px-2 py-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                              Régler
                            </button>
                          )}
                          <button onClick={() => handlePDF(cr)} className="btn text-[10px] px-2 py-1">PDF</button>
                          {(cr.jours_retard ?? 0) > 0 && (
                            <button onClick={() => handleRelance(cr)}
                              className="btn text-[10px] px-2 py-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                              SMS
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.creances.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[#A8A49E] py-10">Aucune créance</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal règlement */}
      <Modal open={!!reglementCreance} onClose={() => setReglementCreance(null)} title="Enregistrer un règlement" size="sm">
        {reglementCreance && (
          <form onSubmit={handleReglementSubmit} className="space-y-4">
            <div className="bg-[#F8F7F4] rounded-lg p-3 text-sm space-y-1">
              <div className="font-medium">{reglementCreance.raison_sociale}</div>
              <div className="font-mono text-[11px] text-[#6B6862]">{reglementCreance.numero}</div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-[#6B6862]">Solde à régler</span>
                <span className="font-mono font-semibold text-red-600">{fcfa(reglementCreance.solde_restant)}</span>
              </div>
            </div>

            <FormRow label="Montant réglé (FCFA)" required>
              <input className="input text-sm font-mono" type="number" min="1" max={reglementCreance.solde_restant}
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

            <FormFooter onCancel={() => setReglementCreance(null)} loading={saving} submitLabel="Valider le règlement" />
          </form>
        )}
      </Modal>
    </>
  );
}
