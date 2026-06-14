import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fcfa, fdate } from '../lib/formatters';
import { toast } from '../components/ui';
import type { Produit, SessionCaisse, Caisse, LignePOS, VenteReglement, SocieteParametres, Lot } from '@storebox/shared';

// ─── Types locaux ─────────────────────────────────────────────────
interface MoyenPaiement { id: number; nom: string; }
interface Referentiels  { moyens_paiement: MoyenPaiement[]; }

// ─── Utilitaire ───────────────────────────────────────────────────
const total = (lignes: LignePOS[]) =>
  lignes.reduce((s, l) => s + Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100)), 0);

// ─── Composant Ticket mini ────────────────────────────────────────
function TicketLine({ l, onQty, onDel }: {
  l: LignePOS;
  onQty: (delta: number) => void;
  onDel: () => void;
}) {
  const sous = Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100));
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-black/[0.06] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[#1A1917] truncate">{l.designation}</div>
        <div className="text-[11px] text-[#A8A49E]">{fcfa(l.prix_unitaire)} / u
          {l.remise_pct > 0 && <span className="ml-1 text-amber-600">-{l.remise_pct}%</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onQty(-1)}
          className="w-6 h-6 rounded-md bg-[#F2F0EB] text-[#6B6862] hover:bg-[#E8E5DF] flex items-center justify-center text-sm font-medium transition-colors">−</button>
        <span className="w-7 text-center text-[12.5px] font-semibold text-[#1A1917]">{l.quantite}</span>
        <button onClick={() => onQty(+1)}
          className="w-6 h-6 rounded-md bg-[#F2F0EB] text-[#6B6862] hover:bg-[#E8E5DF] flex items-center justify-center text-sm font-medium transition-colors">+</button>
        <button onClick={onDel}
          className="w-6 h-6 rounded-md text-[#C4C0BA] hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors ml-0.5">
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="w-20 text-right text-[12.5px] font-semibold text-[#1A1917] flex-shrink-0">{fcfa(sous)}</div>
    </div>
  );
}

// ─── Modal Paiement ───────────────────────────────────────────────
function ModalPaiement({ total_ttc, moyens, onConfirm, onClose }: {
  total_ttc:  number;
  moyens:     MoyenPaiement[];
  onConfirm:  (reglements: VenteReglement[], rendu: number) => void;
  onClose:    () => void;
}) {
  const [reglements, setReglements] = useState<VenteReglement[]>([
    { moyen_paiement_id: moyens[0]?.id, montant: total_ttc }
  ]);

  const totalRegle = reglements.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const rendu      = Math.max(0, totalRegle - total_ttc);
  const reste      = total_ttc - totalRegle;

  const addReglement = () => {
    setReglements(prev => [...prev, { moyen_paiement_id: moyens[0]?.id, montant: Math.max(0, reste) }]);
  };

  const updateReglement = (i: number, field: keyof VenteReglement, val: any) => {
    setReglements(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const removeReglement = (i: number) => {
    setReglements(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.08]">
          <div className="text-[15px] font-semibold text-[#1A1917]">Encaissement</div>
          <div className="text-[24px] font-bold text-[#1A1917] mt-1">{fcfa(total_ttc)}</div>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Règlements */}
          {reglements.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={r.moyen_paiement_id ?? ''}
                onChange={e => updateReglement(i, 'moyen_paiement_id', e.target.value ? +e.target.value : undefined)}
                className="flex-1 text-[12.5px] border border-black/[0.10] rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              >
                <option value="">— Moyen —</option>
                {moyens.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <input
                type="number"
                min="0"
                value={r.montant}
                onChange={e => updateReglement(i, 'montant', Number(e.target.value))}
                className="w-32 text-[12.5px] border border-black/[0.10] rounded-lg px-2.5 py-2 text-right font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              />
              {reglements.length > 1 && (
                <button onClick={() => removeReglement(i)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A8A49E] hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))}

          <button onClick={addReglement}
            className="text-[11.5px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 transition-colors">
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Ajouter un moyen de paiement
          </button>

          {/* Résumé */}
          <div className="bg-[#F8F7F4] rounded-xl p-3 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-[#6B6862]">Total à payer</span>
              <span className="font-semibold text-[#1A1917]">{fcfa(total_ttc)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6862]">Encaissé</span>
              <span className={`font-semibold ${totalRegle >= total_ttc ? 'text-green-600' : 'text-red-500'}`}>
                {fcfa(totalRegle)}
              </span>
            </div>
            {rendu > 0 && (
              <div className="flex justify-between pt-1 border-t border-black/[0.07]">
                <span className="text-[#6B6862] font-medium">Rendu monnaie</span>
                <span className="font-bold text-green-600">{fcfa(rendu)}</span>
              </div>
            )}
            {reste > 0 && (
              <div className="flex justify-between pt-1 border-t border-black/[0.07]">
                <span className="text-[#6B6862]">Reste à payer</span>
                <span className="font-bold text-red-500">{fcfa(reste)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/[0.08] flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.10] text-[13px] font-medium text-[#6B6862] hover:bg-[#F8F7F4] transition-colors">
            Annuler
          </button>
          <button
            onClick={() => totalRegle > 0 && onConfirm(reglements.filter(r => r.montant > 0), rendu)}
            disabled={totalRegle <= 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1A1917] text-white text-[13px] font-semibold hover:bg-[#2C2A27] disabled:opacity-40 transition-colors">
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Ouverture caisse ───────────────────────────────────────
function ModalOuverture({ caisse, onConfirm, onClose }: {
  caisse:    Caisse;
  onConfirm: (fond: number, notes: string) => void;
  onClose:   () => void;
}) {
  const [fond, setFond]   = useState('0');
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-green-600">
              <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 10h20M7 15h.01M12 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-[15px] font-semibold text-[#1A1917] mb-1">Ouvrir — {caisse.nom}</div>
          <div className="text-[12.5px] text-[#A8A49E] mb-5">Saisissez le fond de caisse de départ</div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#6B6862] uppercase tracking-wide mb-1.5 block">
                Fond de caisse (F)
              </label>
              <input type="number" min="0" value={fond}
                onChange={e => setFond(e.target.value)}
                className="w-full border border-black/[0.10] rounded-xl px-3 py-2.5 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6862] uppercase tracking-wide mb-1.5 block">
                Notes (optionnel)
              </label>
              <input type="text" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Caisse du matin"
                className="w-full border border-black/[0.10] rounded-xl px-3 py-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.10] text-[13px] font-medium text-[#6B6862] hover:bg-[#F8F7F4] transition-colors">
            Annuler
          </button>
          <button onClick={() => onConfirm(Number(fond) || 0, notes)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-[13px] font-semibold hover:bg-green-700 transition-colors">
            Ouvrir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Fermeture caisse ───────────────────────────────────────
function ModalFermeture({ session, onConfirm, onClose }: {
  session:   SessionCaisse;
  onConfirm: (montant_reel: number, notes: string) => void;
  onClose:   () => void;
}) {
  const [reel,  setReel]  = useState(String(session.montant_especes_attendu));
  const [notes, setNotes] = useState('');
  const attendu = session.montant_especes_attendu;
  const ecart   = Number(reel) - attendu;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-red-500">
              <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 10h20M7 15h.01M12 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-[15px] font-semibold text-[#1A1917] mb-1">Fermer la caisse</div>
          <div className="text-[12.5px] text-[#A8A49E] mb-5">{session.nb_ventes} vente(s) — {fcfa(session.total_ventes)}</div>

          <div className="bg-[#F8F7F4] rounded-xl p-3 mb-4 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-[#6B6862]">Fond ouverture</span>
              <span className="font-semibold">{fcfa(session.fond_ouverture)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6862]">Espèces attendues</span>
              <span className="font-semibold">{fcfa(attendu)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#6B6862] uppercase tracking-wide mb-1.5 block">
                Espèces comptées (F)
              </label>
              <input type="number" min="0" value={reel}
                onChange={e => setReel(e.target.value)}
                className="w-full border border-black/[0.10] rounded-xl px-3 py-2.5 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              />
            </div>
            {reel !== '' && (
              <div className={`flex justify-between text-[12.5px] font-semibold px-1 ${ecart === 0 ? 'text-green-600' : ecart > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                <span>Écart</span>
                <span>{ecart >= 0 ? '+' : ''}{fcfa(ecart)}</span>
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-[#6B6862] uppercase tracking-wide mb-1.5 block">Notes</label>
              <input type="text" value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-black/[0.10] rounded-xl px-3 py-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50"
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.10] text-[13px] font-medium text-[#6B6862] hover:bg-[#F8F7F4] transition-colors">
            Annuler
          </button>
          <button onClick={() => onConfirm(Number(reel) || 0, notes)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors">
            Fermer la caisse
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Interface Ticket ─────────────────────────────────────────────
interface TicketData {
  numero:      string;
  lignes:      LignePOS[];
  reglements:  VenteReglement[];
  rendu:       number;
  total_ttc:   number;
  societe?:    Pick<SocieteParametres, 'nom' | 'logo_url' | 'adresse' | 'telephone'>;
  caissier?:   string;
}

// ─── Modal Ticket / Reçu ──────────────────────────────────────────
function ModalTicket({ ticket, onClose }: { ticket: TicketData; onClose: () => void }) {
  const handlePrint = () => {
    const style = `
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .line   { border-top: 1px dashed #000; margin: 4px 0; }
        .row    { display: flex; justify-content: space-between; margin: 2px 0; }
        .logo   { max-width: 40mm; max-height: 15mm; margin: 0 auto 4px; display: block; }
        .total  { font-size: 15px; font-weight: bold; }
        .rendu  { font-size: 13px; font-weight: bold; }
        @media print { @page { margin: 0; size: 80mm auto; } body { width: 80mm; } }
      </style>`;
    const now = new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
    const lignesHtml = ticket.lignes.map(l => {
      const sous = Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100));
      return `<div class="row"><span>${l.designation} x${l.quantite}</span><span>${fcfa(sous)}</span></div>`;
    }).join('');
    const reglementsHtml = ticket.reglements.map(r =>
      `<div class="row"><span>${r.moyen_paiement ?? 'Paiement'}</span><span>${fcfa(r.montant)}</span></div>`
    ).join('');
    const logoHtml = ticket.societe?.logo_url
      ? `<img src="${ticket.societe.logo_url}" class="logo" alt="Logo" />`
      : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>
      ${logoHtml}
      <div class="center bold" style="font-size:14px">${ticket.societe?.nom ?? 'StoreBox'}</div>
      ${ticket.societe?.adresse ? `<div class="center">${ticket.societe.adresse}</div>` : ''}
      ${ticket.societe?.telephone ? `<div class="center">Tél: ${ticket.societe.telephone}</div>` : ''}
      <div class="center" style="margin-top:4px">${now}</div>
      ${ticket.caissier ? `<div class="center">Caissier: ${ticket.caissier}</div>` : ''}
      <div class="center bold">${ticket.numero}</div>
      <div class="line"></div>
      ${lignesHtml}
      <div class="line"></div>
      <div class="row total"><span>TOTAL TTC</span><span>${fcfa(ticket.total_ttc)}</span></div>
      <div class="line"></div>
      ${reglementsHtml}
      ${ticket.rendu > 0 ? `<div class="row rendu"><span>RENDU</span><span>${fcfa(ticket.rendu)}</span></div>` : ''}
      <div class="line"></div>
      <div class="center" style="margin-top:6px; font-size:11px">Merci pour votre achat !</div>
    </body></html>`;

    // Impression via iframe caché — évite les bloqueurs de popups
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:200mm;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      // Laisser le navigateur charger les styles avant d'imprimer
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 1000);
        }
      }, 300);
    }
  };

  const tva = Math.round(ticket.total_ttc / 1.18 * 0.18);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.08] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold text-[#1A1917]">Reçu</div>
            <div className="font-mono text-[11px] text-[#A8A49E]">{ticket.numero}</div>
          </div>
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-green-600">
              <path d="M5 10l3.5 3.5L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Corps ticket */}
        <div className="px-6 py-4 font-mono text-[12px] space-y-1">
          {ticket.lignes.map((l, i) => {
            const sous = Math.round(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100));
            return (
              <div key={i} className="flex justify-between">
                <span className="text-[#6B6862] truncate max-w-[60%]">{l.designation} ×{l.quantite}</span>
                <span className="font-medium text-[#1A1917]">{fcfa(sous)}</span>
              </div>
            );
          })}

          <div className="border-t border-dashed border-black/[0.15] pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-[#A8A49E]">
              <span>HT</span><span>{fcfa(ticket.total_ttc - tva)}</span>
            </div>
            <div className="flex justify-between text-[#A8A49E]">
              <span>TVA 18%</span><span>{fcfa(tva)}</span>
            </div>
            <div className="flex justify-between text-[14px] font-bold text-[#1A1917] pt-1">
              <span>TOTAL</span><span>{fcfa(ticket.total_ttc)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black/[0.15] pt-2 mt-2 space-y-1">
            {ticket.reglements.map((r, i) => (
              <div key={i} className="flex justify-between text-[#6B6862]">
                <span>{r.moyen_paiement ?? 'Paiement'}</span>
                <span>{fcfa(r.montant)}</span>
              </div>
            ))}
            {ticket.rendu > 0 && (
              <div className="flex justify-between font-bold text-green-600">
                <span>RENDU</span><span>{fcfa(ticket.rendu)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.10] text-[13px] font-medium text-[#6B6862] hover:bg-[#F8F7F4] transition-colors">
            Fermer
          </button>
          <button onClick={handlePrint}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1A1917] text-white text-[13px] font-semibold hover:bg-[#2C2A27] transition-colors flex items-center justify-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M4 5V2h8v3M4 11H2a1 1 0 01-1-1V6a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────
export default function CaissePage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const [session,            setSession]            = useState<SessionCaisse | null | undefined>(undefined);
  const [caisses,            setCaisses]            = useState<Caisse[]>([]);
  const [caisseSelectionnee, setCaisseSelectionnee] = useState<Caisse | null>(null);
  const [produits,    setProduits]    = useState<Produit[]>([]);
  const [moyens,      setMoyens]      = useState<MoyenPaiement[]>([]);
  const [panier,      setPanier]      = useState<LignePOS[]>([]);
  const [search,      setSearch]      = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showPaiment, setShowPaiment] = useState(false);
  const [showOuvrir,  setShowOuvrir]  = useState(false);
  const [showFermer,  setShowFermer]  = useState(false);
  const [lastTicket,  setLastTicket]  = useState<{ numero: string; rendu: number } | null>(null);
  const [showTicket,  setShowTicket]  = useState(false);
  const [ticketData,  setTicketData]  = useState<TicketData | null>(null);
  const [societe,     setSociete]     = useState<Pick<SocieteParametres, 'nom' | 'logo_url' | 'adresse' | 'telephone'> | null>(null);
  const [peseeProduit, setPeseeProduit] = useState<Produit | null>(null);

  // Chargement initial — chaque appel est indépendant
  // pour qu'une erreur sur /produits ne ferme pas la caisse
  useEffect(() => {
    api.get<SessionCaisse | null>('/caisse/session-active')
      .then(s => setSession(s.success ? (s.data ?? null) : null))
      .catch(() => setSession(null));

    api.get<Caisse[]>('/caisse/caisses')
      .then(c => { if (c.success && c.data) setCaisses(c.data); });

    api.get<Produit[]>('/produits')
      .then(p => { if (p.success && p.data) setProduits(p.data); });

    api.get<Referentiels>('/referentiels')
      .then(r => { if (r.success && r.data) setMoyens(r.data.moyens_paiement); });

    api.get<SocieteParametres>('/societe')
      .then(soc => { if (soc.success && soc.data) setSociete(soc.data); });
  }, []);

  // Filtrage produits
  const produitsFiltres = search.trim()
    ? produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 24)
    : produits.slice(0, 24);

  const totalPanier   = total(panier);
  const tva18         = Math.round(totalPanier / 1.18 * 0.18);

  // Ajouter une ligne déjà préparée (quantité/prix connus)
  const pushLigne = useCallback((p: Produit, quantite: number, prix_unitaire: number) => {
    setPanier(prev => {
      const idx = prev.findIndex(l => l.produit_id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantite: copy[idx].quantite + quantite, prix_unitaire };
        return copy;
      }
      return [...prev, {
        produit_id: p.id, designation: p.designation, reference: p.reference,
        prix_unitaire, quantite, remise_pct: 0, stock: p.stock,
        unite_code: p.unite_code, unite_decimales: p.unite_decimales,
        vendu_au_poids: p.vendu_au_poids, prix_modifiable: p.prix_modifiable,
      }];
    });
    setSearch('');
  }, []);

  // Ajouter au panier — ouvre la modale de pesée si poids/prix variable
  const addProduit = useCallback((p: Produit) => {
    if (p.vendu_au_poids || p.prix_modifiable) {
      setPeseeProduit(p);
      return;
    }
    pushLigne(p, 1, p.prix_detail ?? p.prix_gros);
  }, [pushLigne]);

  // Modifier quantité — pas adapté à l'unité (1 pour pièce, 0.1 pour poids)
  const updateQty = (idx: number, delta: number) => {
    setPanier(prev => {
      const copy = [...prev];
      const l = copy[idx];
      const pas = l.vendu_au_poids ? 0.1 : 1;
      const newQty = Math.round((l.quantite + delta * pas) * 1000) / 1000;
      if (newQty <= 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...l, quantite: newQty };
      return copy;
    });
  };

  // Ouvrir caisse
  const ouvrirCaisse = async (fond: number, notes: string) => {
    if (!caisseSelectionnee) return;
    setSaving(true);
    const r = await api.post<SessionCaisse>('/caisse/ouvrir', {
      caisse_id:     caisseSelectionnee.id,
      fond_ouverture: fond,
      notes,
    });
    setSaving(false);
    if (r.success && r.data) {
      setSession(r.data);
      setShowOuvrir(false);
      setCaisseSelectionnee(null);
      // Rafraîchir la liste des caisses
      api.get<Caisse[]>('/caisse/caisses').then(c => { if (c.success && c.data) setCaisses(c.data); });
      toast(`${caisseSelectionnee.nom} ouverte`, 'success');
    } else {
      toast(r.error ?? 'Erreur', 'error');
    }
  };

  // Fermer caisse
  const fermerCaisse = async (montant_reel: number, notes: string) => {
    if (!session) return;
    setSaving(true);
    const r = await api.post<SessionCaisse>('/caisse/fermer', { montant_especes_reel: montant_reel, notes });
    setSaving(false);
    if (r.success) {
      toast('Caisse fermée', 'success');
      navigate('/caisse/sessions');
    } else {
      toast(r.error ?? 'Erreur', 'error');
    }
  };

  // Valider vente POS
  const validerVente = async (reglements: VenteReglement[], rendu: number) => {
    if (!panier.length) return;
    setSaving(true);
    const r = await api.post<{ id: number; numero: string }>('/caisse/vente-rapide', {
      lignes: panier.map(l => ({
        produit_id: l.produit_id, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, remise_pct: l.remise_pct,
      })),
      reglements,
    });
    setSaving(false);
    if (r.success && r.data) {
      // Construire les données du ticket avant de vider le panier
      const reglementsEnrichis = reglements.map(reg => ({
        ...reg,
        moyen_paiement: moyens.find(m => m.id === reg.moyen_paiement_id)?.nom,
      }));
      setTicketData({
        numero:    r.data.numero,
        lignes:    [...panier],
        reglements: reglementsEnrichis,
        rendu,
        total_ttc: totalPanier,
        societe:   societe ?? undefined,
        caissier:  session?.caissier_nom,
      });
      setShowTicket(true);
      setLastTicket({ numero: r.data.numero, rendu });
      setPanier([]);
      setShowPaiment(false);
      // Mettre à jour les compteurs — tenter de sync depuis l'API,
      // sinon incrémenter localement. La session ne se ferme JAMAIS ici.
      const montantVente = totalPanier;
      api.get<SessionCaisse | null>('/caisse/session-active').then(s => {
        if (s.success && s.data) {
          setSession(s.data); // Données fraîches depuis le serveur
        } else {
          // API indisponible : incrémenter localement
          setSession(prev => prev ? {
            ...prev,
            nb_ventes:    (prev.nb_ventes    ?? 0) + 1,
            total_ventes: (prev.total_ventes ?? 0) + montantVente,
          } : prev);
        }
      }).catch(() => {
        setSession(prev => prev ? {
          ...prev,
          nb_ventes:    (prev.nb_ventes    ?? 0) + 1,
          total_ventes: (prev.total_ventes ?? 0) + montantVente,
        } : prev);
      });
      toast(`Vente ${r.data.numero} enregistrée`, 'success');
    } else {
      toast(r.error ?? 'Erreur lors de la vente', 'error');
    }
  };

  // ─── Chargement initial ────────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1A1917]/20 border-t-[#1A1917] rounded-full animate-spin"/>
      </div>
    );
  }

  // ─── Pas de session — Sélecteur de caisses ────────────────────
  if (session === null) {
    return (
      <div className="flex-1 flex flex-col p-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[18px] font-bold text-[#1A1917]">Point de vente</div>
          <div className="text-[13px] text-[#A8A49E] mt-0.5">
            Sélectionnez une caisse pour ouvrir une session
          </div>
        </div>

        {/* Grille des caisses */}
        {caisses.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1A1917]/20 border-t-[#1A1917] rounded-full animate-spin"/>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {caisses.map(c => {
              const estOuverte = !!c.session_active;
              return (
                <button
                  key={c.id}
                  disabled={estOuverte}
                  onClick={() => { setCaisseSelectionnee(c); setShowOuvrir(true); }}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    estOuverte
                      ? 'border-green-200 bg-green-50 cursor-not-allowed'
                      : 'border-black/[0.08] bg-white hover:border-black/[0.20] hover:shadow-md active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      estOuverte ? 'bg-green-100' : 'bg-[#F2F0EB]'
                    }`}>
                      <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${estOuverte ? 'text-green-600' : 'text-[#6B6862]'}`}>
                        <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M2 10h20M7 15h.01M12 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                      estOuverte
                        ? 'bg-green-100 text-green-700'
                        : 'bg-[#F2F0EB] text-[#6B6862]'
                    }`}>
                      {estOuverte && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>}
                      {estOuverte ? 'Ouverte' : 'Disponible'}
                    </span>
                  </div>

                  <div className="text-[15px] font-semibold text-[#1A1917]">{c.nom}</div>

                  {estOuverte && c.session_active ? (
                    <div className="mt-1.5 space-y-0.5">
                      <div className="text-[12px] text-green-700 font-medium">
                        {c.session_active.caissier_nom}
                      </div>
                      <div className="text-[11.5px] text-[#A8A49E]">
                        {(c.session_active as any).nb_ventes ?? 0} vente(s) · {fcfa((c.session_active as any).total_ventes ?? 0)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[12px] text-[#A8A49E]">
                      Cliquer pour ouvrir
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Lien historique */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/caisse/sessions')}
            className="text-[12.5px] text-[#A8A49E] hover:text-[#1A1917] transition-colors underline underline-offset-2"
          >
            Voir l'historique des sessions
          </button>
        </div>

        {showOuvrir && caisseSelectionnee && (
          <ModalOuverture
            caisse={caisseSelectionnee}
            onConfirm={ouvrirCaisse}
            onClose={() => { setShowOuvrir(false); setCaisseSelectionnee(null); }}
          />
        )}
      </div>
    );
  }

  // ─── Interface POS ─────────────────────────────────────────────
  return (
    <div className="flex-1 flex h-full overflow-hidden">

      {/* ── Grille produits (gauche) ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-black/[0.08]">

        {/* Barre session + recherche */}
        <div className="px-4 py-3 bg-white border-b border-black/[0.08] flex items-center gap-3">
          {/* Info session */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
            <span className="text-[11.5px] font-medium text-green-700">
              {session.caisse_nom ?? 'Caisse'} · {session.nb_ventes} vente(s)
            </span>
          </div>

          {/* Recherche */}
          <div className="flex-1 relative">
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A49E]">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-8 pr-3 py-2 text-[12.5px] bg-[#F8F7F4] border border-black/[0.07] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50 focus:bg-white transition-all"
            />
          </div>

          {/* Fermer caisse */}
          <button
            onClick={() => setShowFermer(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex-shrink-0"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <rect x="2" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="7" cy="8" r="1" fill="currentColor"/>
            </svg>
            Fermer
          </button>
        </div>

        {/* Grille */}
        <div className="flex-1 overflow-y-auto p-4">
          {produitsFiltres.length === 0 ? (
            <div className="text-center py-12 text-[#A8A49E] text-[13px]">Aucun produit trouvé</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {produitsFiltres.map(p => {
                const enPanier = panier.find(l => l.produit_id === p.id)?.quantite ?? 0;
                const rupture  = (p.stock ?? 0) <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => !rupture && addProduit(p)}
                    disabled={rupture}
                    className={`relative text-left p-3 rounded-xl border transition-all duration-150 group ${
                      rupture
                        ? 'bg-[#F8F7F4] border-black/[0.06] opacity-50 cursor-not-allowed'
                        : enPanier > 0
                          ? 'bg-brand-50 border-brand-300 shadow-sm'
                          : 'bg-white border-black/[0.08] hover:border-black/[0.15] hover:shadow-sm active:scale-[0.98]'
                    }`}
                  >
                    {enPanier > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1A1917] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {enPanier}
                      </div>
                    )}
                    <div className="text-[12px] font-medium text-[#1A1917] leading-tight mb-1.5 line-clamp-2">
                      {p.designation}
                    </div>
                    <div className="text-[13px] font-bold text-[#1A1917]">
                      {fcfa(p.prix_detail ?? p.prix_gros)}
                    </div>
                    <div className={`text-[10.5px] mt-0.5 font-mono ${rupture ? 'text-red-400' : 'text-[#B0ABA5]'}`}>
                      {rupture ? 'Rupture' : `Stock: ${p.stock}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panier (droite) ── */}
      <div className="w-80 xl:w-96 flex flex-col flex-shrink-0 bg-white">

        {/* Header panier */}
        <div className="px-4 py-3 border-b border-black/[0.08] flex items-center justify-between">
          <div className="text-[13px] font-semibold text-[#1A1917]">
            Panier
            {panier.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-[#F2F0EB] rounded-full text-[11px] font-medium text-[#6B6862]">
                {panier.reduce((s, l) => s + l.quantite, 0)} article(s)
              </span>
            )}
          </div>
          {panier.length > 0 && (
            <button
              onClick={() => setPanier([])}
              className="text-[11.5px] text-red-400 hover:text-red-600 transition-colors"
            >
              Vider
            </button>
          )}
        </div>

        {/* Lignes panier */}
        <div className="flex-1 overflow-y-auto px-4">
          {panier.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-14 h-14 bg-[#F8F7F4] rounded-xl flex items-center justify-center mb-3">
                <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[#C4C0BA]">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-[12.5px] text-[#A8A49E]">Cliquez sur un produit<br/>pour l'ajouter</div>
            </div>
          ) : (
            <div className="py-2">
              {panier.map((l, i) => (
                <TicketLine
                  key={`${l.produit_id}-${i}`}
                  l={l}
                  onQty={delta => updateQty(i, delta)}
                  onDel={() => setPanier(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Ticket dernier rendu */}
        {lastTicket && (
          <div className="mx-4 mb-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[12px]">
            <div className="font-semibold text-green-700">✓ {lastTicket.numero}</div>
            {lastTicket.rendu > 0 && (
              <div className="text-green-600 mt-0.5">Rendu : {fcfa(lastTicket.rendu)}</div>
            )}
          </div>
        )}

        {/* Total + bouton payer */}
        <div className="px-4 pb-4 pt-3 border-t border-black/[0.08] space-y-2">
          <div className="flex justify-between text-[12px] text-[#6B6862]">
            <span>Sous-total HT</span>
            <span>{fcfa(totalPanier - tva18)}</span>
          </div>
          <div className="flex justify-between text-[12px] text-[#6B6862]">
            <span>TVA 18%</span>
            <span>{fcfa(tva18)}</span>
          </div>
          <div className="flex justify-between text-[15px] font-bold text-[#1A1917] pt-1 border-t border-black/[0.08]">
            <span>Total TTC</span>
            <span>{fcfa(totalPanier)}</span>
          </div>
          <button
            onClick={() => panier.length > 0 && setShowPaiment(true)}
            disabled={panier.length === 0 || saving}
            className="w-full py-3 bg-[#1A1917] text-white rounded-xl text-[14px] font-bold hover:bg-[#2C2A27] disabled:opacity-40 transition-colors mt-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M1 7h14M5 10.5h.01M8 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Encaisser {fcfa(totalPanier)}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modales */}
      {showPaiment && (
        <ModalPaiement
          total_ttc={totalPanier}
          moyens={moyens}
          onConfirm={validerVente}
          onClose={() => setShowPaiment(false)}
        />
      )}
      {showFermer && session && (
        <ModalFermeture
          session={session}
          onConfirm={fermerCaisse}
          onClose={() => setShowFermer(false)}
        />
      )}
      {showTicket && ticketData && (
        <ModalTicket
          ticket={ticketData}
          onClose={() => setShowTicket(false)}
        />
      )}
      {peseeProduit && (
        <ModalPesee
          produit={peseeProduit}
          onConfirm={(qte, prix) => { pushLigne(peseeProduit, qte, prix); setPeseeProduit(null); }}
          onClose={() => setPeseeProduit(null)}
        />
      )}
    </div>
  );
}

// ─── Modale de pesée / prix variable ──────────────────────────────
function ModalPesee({ produit, onConfirm, onClose }: {
  produit: Produit;
  onConfirm: (quantite: number, prix_unitaire: number) => void;
  onClose: () => void;
}) {
  const decimales = produit.unite_decimales ?? (produit.vendu_au_poids ? 3 : 0);
  const unite     = produit.unite_code ?? 'u';
  const [qte,  setQte]  = useState('1');
  const [prix, setPrix] = useState(String(produit.prix_detail ?? produit.prix_gros ?? 0));
  const [lot,  setLot]  = useState<Lot | null>(null);   // prochain lot consommé (FIFO)
  const q = Number(qte) || 0;
  const p = Number(prix) || 0;
  const sousTotal = Math.round(q * p);

  // Récupère le lot le plus proche de péremption (1er servi par le FIFO)
  useEffect(() => {
    if (!produit.gere_lot) return;
    api.get<Lot[]>(`/stock/lots?produit_id=${produit.id}`)
      .then(r => { if (r.success && r.data?.length) setLot(r.data[0]); })
      .catch(() => {});
  }, [produit.id, produit.gere_lot]);

  const lotCls = (j?: number) =>
    j == null ? 'bg-gray-100 text-gray-500'
      : j < 0  ? 'bg-red-100 text-red-700'
      : j <= 3 ? 'bg-orange-50 text-orange-700'
      : j <= 7 ? 'bg-amber-50 text-amber-700'
      : 'bg-green-50 text-green-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#1A1917]">{produit.designation}</h3>
        <p className="text-[13px] text-[#6B6862] mb-2">
          {produit.vendu_au_poids ? `Vendu au ${unite}` : 'Prix à saisir'}
        </p>
        {lot && (
          <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
            <span className={`px-2 py-0.5 rounded-full font-medium ${lotCls(lot.jours_restants)}`}>
              Lot FIFO{lot.jours_restants != null && (lot.jours_restants < 0
                ? ` · périmé +${Math.abs(lot.jours_restants)}j`
                : ` · J-${lot.jours_restants}`)}
            </span>
            <span className="text-[#6B6862]">
              {lot.numero_lot ?? '—'}{lot.date_peremption ? ` · DLC ${fdate(lot.date_peremption)}` : ''} · reste {lot.quantite}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#6B6862] mb-1">Quantité ({unite})</label>
            <input
              autoFocus type="number" min="0" step={decimales > 0 ? Math.pow(10, -decimales) : 1}
              className="input text-lg font-mono w-full"
              value={qte} onChange={e => setQte(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B6862] mb-1">
              Prix / {unite} (F){produit.prix_modifiable ? '' : ' — fixe'}
            </label>
            <input
              type="number" min="0" disabled={!produit.prix_modifiable}
              className="input text-lg font-mono w-full disabled:bg-[#F5F3EF]"
              value={prix} onChange={e => setPrix(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-between items-center bg-[#F5F3EF] rounded-lg px-4 py-3 mt-4">
          <span className="text-[13px] text-[#6B6862]">Sous-total</span>
          <span className="text-xl font-bold text-[#1A1917]">{fcfa(sousTotal)}</span>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="flex-1 px-4 py-2.5 rounded-lg border border-[#E7E4DE] text-[#6B6862]" onClick={onClose}>
            Annuler
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#1A1917] text-white font-medium disabled:opacity-40"
            disabled={q <= 0 || p <= 0}
            onClick={() => onConfirm(q, p)}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
