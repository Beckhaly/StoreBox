import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { BADGE_CLASSES } from '../lib/formatters';
import { useApi } from '../hooks/useApi';
import { fcfa, fdate } from '../lib/formatters';
import { api } from '../lib/api';
import { toast } from '../components/ui';
import type { SessionCaisse } from '@storebox/shared';

interface SessionDetail extends SessionCaisse {
  ventes: {
    id: number; numero: string; total_ttc: number;
    statut_paiement: string; client_nom: string;
    reglements: { moyen: string; montant: number }[];
  }[];
  par_moyen: { moyen: string; total: number }[];
}

function dureeLabel(heures: number) {
  const h = Math.floor(heures);
  const m = Math.round((heures - h) * 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function CaisseSessionsPage() {
  const navigate = useNavigate();
  const { data: sessions = [], loading } = useApi<SessionCaisse[]>('/caisse/sessions');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail,     setDetail]     = useState<SessionDetail | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);

  const openDetail = async (id: number) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(id);
    setLoadingDet(true);
    const r = await api.get<SessionDetail>(`/caisse/sessions/${id}`);
    setLoadingDet(false);
    if (r.success && r.data) setDetail(r.data);
    else toast('Erreur chargement', 'error');
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto space-y-5 animate-fade-in">
      <PageHeader
        title="Sessions de caisse"
        subtitle="Historique des ouvertures et fermetures"
        action={
          <button
            onClick={() => navigate('/caisse')}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1917] text-white rounded-xl text-[13px] font-medium hover:bg-[#2C2A27] transition-colors"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <rect x="2" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="7" cy="8" r="1" fill="currentColor"/>
            </svg>
            Aller à la caisse
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-[#1A1917]/20 border-t-[#1A1917] rounded-full animate-spin"/>
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="text-center py-16 text-[#A8A49E] text-[13px]">
          Aucune session enregistrée
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
              {/* Ligne résumé */}
              <button
                onClick={() => openDetail(s.id)}
                className="w-full text-left px-5 py-4 hover:bg-[#FAFAF9] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Statut */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.statut === 'ouverte' ? 'bg-green-500 animate-pulse' : 'bg-[#C4C0BA]'}`}/>

                  {/* Info principale */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[13px] font-semibold text-[#1A1917]">{s.caissier_nom}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${
                        s.statut === 'ouverte' ? BADGE_CLASSES.green : BADGE_CLASSES.gray
                      }`}>
                        {s.statut === 'ouverte' ? 'Ouverte' : 'Fermée'}
                      </span>
                      <span className="text-[11.5px] text-[#A8A49E]">{s.magasin_nom}</span>
                    </div>
                    <div className="text-[11.5px] text-[#A8A49E] mt-0.5">
                      {fdate(s.ouvert_a)}
                      {s.ferme_a && ` → ${fdate(s.ferme_a)}`}
                      {s.duree_heures != null && ` · ${dureeLabel(s.duree_heures)}`}
                    </div>
                  </div>

                  {/* Chiffres */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div className="text-[14px] font-bold text-[#1A1917]">{fcfa(s.total_ventes)}</div>
                    <div className="text-[11.5px] text-[#A8A49E]">{s.nb_ventes} vente(s)</div>
                  </div>

                  {/* Écart */}
                  {s.ecart != null && (
                    <div className={`text-right flex-shrink-0 text-[13px] font-semibold ${
                      s.ecart === 0 ? 'text-green-600' : s.ecart > 0 ? 'text-blue-600' : 'text-red-500'
                    }`}>
                      {s.ecart >= 0 ? '+' : ''}{fcfa(s.ecart)}
                    </div>
                  )}

                  {/* Chevron */}
                  <svg viewBox="0 0 14 14" fill="none" className={`w-3.5 h-3.5 text-[#C4C0BA] flex-shrink-0 transition-transform ${selectedId === s.id ? 'rotate-180' : ''}`}>
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
              </button>

              {/* Détail déplié */}
              {selectedId === s.id && (
                <div className="border-t border-black/[0.07] px-5 py-4">
                  {loadingDet ? (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-[#1A1917]/20 border-t-[#1A1917] rounded-full animate-spin"/>
                    </div>
                  ) : detail ? (
                    <div className="grid sm:grid-cols-2 gap-5">
                      {/* Récap financier */}
                      <div>
                        <div className="text-[10.5px] font-mono text-[#B0ABA5] uppercase tracking-widest mb-3">Récapitulatif</div>
                        <div className="space-y-2 text-[12.5px]">
                          <div className="flex justify-between">
                            <span className="text-[#6B6862]">Fond ouverture</span>
                            <span className="font-medium">{fcfa(detail.fond_ouverture)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6B6862]">Total ventes</span>
                            <span className="font-semibold text-[#1A1917]">{fcfa(detail.total_ventes)}</span>
                          </div>
                          {detail.par_moyen.map(pm => (
                            <div key={pm.moyen} className="flex justify-between pl-3 border-l-2 border-[#F2F0EB]">
                              <span className="text-[#A8A49E]">{pm.moyen ?? 'Non spécifié'}</span>
                              <span>{fcfa(pm.total)}</span>
                            </div>
                          ))}
                          {detail.montant_especes_attendu != null && (
                            <>
                              <div className="flex justify-between pt-1 border-t border-black/[0.06]">
                                <span className="text-[#6B6862]">Espèces attendues</span>
                                <span className="font-medium">{fcfa(detail.montant_especes_attendu)}</span>
                              </div>
                              {detail.montant_especes_reel != null && (
                                <div className="flex justify-between">
                                  <span className="text-[#6B6862]">Espèces comptées</span>
                                  <span className="font-medium">{fcfa(detail.montant_especes_reel)}</span>
                                </div>
                              )}
                              {detail.ecart != null && (
                                <div className={`flex justify-between font-semibold ${
                                  detail.ecart === 0 ? 'text-green-600' : detail.ecart > 0 ? 'text-blue-600' : 'text-red-500'
                                }`}>
                                  <span>Écart</span>
                                  <span>{detail.ecart >= 0 ? '+' : ''}{fcfa(detail.ecart)}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Liste ventes */}
                      <div>
                        <div className="text-[10.5px] font-mono text-[#B0ABA5] uppercase tracking-widest mb-3">
                          Ventes ({detail.ventes.length})
                        </div>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {detail.ventes.length === 0 ? (
                            <div className="text-[12px] text-[#A8A49E]">Aucune vente</div>
                          ) : detail.ventes.map(v => (
                            <div key={v.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-black/[0.04] last:border-0">
                              <div>
                                <span className="font-mono text-[#6B6862]">{v.numero}</span>
                                {v.client_nom && <span className="ml-2 text-[#A8A49E] truncate max-w-[100px] inline-block">{v.client_nom}</span>}
                              </div>
                              <span className="font-semibold text-[#1A1917]">{fcfa(v.total_ttc)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
