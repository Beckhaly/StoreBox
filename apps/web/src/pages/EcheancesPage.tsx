import { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Spinner } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Creance, Dette } from '@storebox/shared';
import { fcfa, fdate } from '../lib/formatters';

// Mini badge inline pour éviter la dépendance au composant Badge (qui résout via statut preset)
function MiniTag({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{label}</span>;
}

interface CreancesData { creances: Creance[]; }
interface DettesData { dettes: Dette[]; }

type Echeance = { id: number; type: 'client' | 'fournisseur'; raison_sociale: string; montant: number; date_echeance: string };

export default function EcheancesPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [type, setType] = useState('');

  const { data: creancesData, loading: loadingCreances } = useApi<CreancesData>('/creances');
  const { data: dettesData, loading: loadingDettes } = useApi<DettesData>('/dettes');

  const echeances = useMemo(() => {
    const arr: Echeance[] = [];
    if (creancesData?.creances) {
      creancesData.creances.forEach(c => {
        if (c.date_echeance) {
          arr.push({
            id: c.id,
            type: 'client',
            raison_sociale: c.raison_sociale,
            montant: c.solde_restant,
            date_echeance: c.date_echeance,
          });
        }
      });
    }
    if (dettesData?.dettes) {
      dettesData.dettes.forEach(d => {
        if (d.date_echeance) {
          arr.push({
            id: d.id,
            type: 'fournisseur',
            raison_sociale: d.raison_sociale,
            montant: d.solde_restant,
            date_echeance: d.date_echeance,
          });
        }
      });
    }
    return arr
      .filter(e => !type || e.type === type)
      .filter(e => !dateDebut || new Date(e.date_echeance) >= new Date(dateDebut))
      .filter(e => !dateFin || new Date(e.date_echeance) <= new Date(dateFin))
      .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime());
  }, [creancesData, dettesData, type, dateDebut, dateFin]);

  const total = useMemo(() => {
    const urgent = echeances.filter(e => {
      const diff = new Date(e.date_echeance).getTime() - new Date().getTime();
      return diff < 7 * 24 * 60 * 60 * 1000 && diff >= 0;
    }).reduce((s, e) => s + e.montant, 0);
    const bientot = echeances.filter(e => {
      const diff = new Date(e.date_echeance).getTime() - new Date().getTime();
      return diff >= 7 * 24 * 60 * 60 * 1000 && diff < 30 * 24 * 60 * 60 * 1000;
    }).reduce((s, e) => s + e.montant, 0);
    return { total: echeances.reduce((s, e) => s + e.montant, 0), urgent, bientot };
  }, [echeances]);

  const resetFiltres = () => { setDateDebut(''); setDateFin(''); setType(''); };
  const hasFilters = dateDebut || dateFin || type;
  const loading = loadingCreances || loadingDettes;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Échéances" subtitle="Dates clés — Clients & Fournisseurs" />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'TOTAL ÉCHÉANCES', value: fcfa(total.total), cls: '' },
            { label: 'URGENT (<7J)', value: fcfa(total.urgent), cls: 'text-red-600' },
            { label: 'BIENTÔT (7-30J)', value: fcfa(total.bientot), cls: 'text-amber-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metric-card">
              <div className="font-mono text-[10px] text-[#A8A49E] mb-1.5">{label}</div>
              <div className={`text-lg sm:text-[22px] font-light ${cls || 'text-[#1A1917]'}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="card p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-[#6B6862] mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input text-sm">
                <option value="">Tous</option>
                <option value="client">Clients</option>
                <option value="fournisseur">Fournisseurs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B6862] mb-1">Du</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B6862] mb-1">Au</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="input text-sm" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={resetFiltres} className="text-xs text-[#1B5FD6] hover:underline">
              ✕ Réinitialiser filtres
            </button>
          )}
        </div>

        {echeances.length === 0 ? (
          <div className="card p-6 text-center text-[#6B6862]">
            <p className="text-sm">Aucune échéance trouvée</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E5DDD2]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-mono text-[#A8A49E]">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-mono text-[#A8A49E]">Tiers</th>
                  <th className="px-4 py-2.5 text-left text-xs font-mono text-[#A8A49E]">Montant</th>
                  <th className="px-4 py-2.5 text-left text-xs font-mono text-[#A8A49E]">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-mono text-[#A8A49E]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {echeances.map(ech => {
                  const diff = new Date(ech.date_echeance).getTime() - new Date().getTime();
                  const isEchu = diff < 0;
                  const isUrgent = diff < 7 * 24 * 60 * 60 * 1000 && diff >= 0;
                  const isBientot = diff >= 7 * 24 * 60 * 60 * 1000 && diff < 30 * 24 * 60 * 60 * 1000;

                  return (
                    <tr key={`${ech.type}-${ech.id}`} className="border-b border-[#E5DDD2] hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3">
                        <MiniTag label={ech.type === 'client' ? 'Client' : 'Fournisseur'} cls={ech.type === 'client' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'} />
                      </td>
                      <td className="px-4 py-3 text-[#1A1917]">{ech.raison_sociale}</td>
                      <td className="px-4 py-3 font-mono text-[#1A1917]">{fcfa(ech.montant)}</td>
                      <td className="px-4 py-3 text-[#6B6862]">{fdate(ech.date_echeance)}</td>
                      <td className="px-4 py-3">
                        {isEchu ? (
                          <MiniTag label="Échu" cls="bg-red-50 text-red-700" />
                        ) : isUrgent ? (
                          <MiniTag label="Urgent" cls="bg-red-50 text-red-700" />
                        ) : isBientot ? (
                          <MiniTag label="Bientôt" cls="bg-amber-50 text-amber-700" />
                        ) : (
                          <MiniTag label="OK" cls="bg-green-50 text-green-700" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
