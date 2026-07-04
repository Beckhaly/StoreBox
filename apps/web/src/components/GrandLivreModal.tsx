import { useEffect, useState, useCallback } from 'react';
import { Modal } from './ui/Modal';
import { Spinner } from './ui';
import { api } from '../lib/api';
import { fcfa, fdate } from '../lib/formatters';

interface Ligne { date: string; texte: string; recu: number; paye: number; solde: number; }
interface GrandLivre {
  client: { code: string; raison_sociale: string; telephone?: string; ville?: string };
  periode: { debut: string; fin: string };
  solde_precedent: number;
  lignes: Ligne[];
  total_recu: number;
  total_paye: number;
  solde_periode: number;
  solde_final: number;
}

const moisCourant = () => {
  const n = new Date();
  return {
    debut: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10),
    fin:   n.toISOString().slice(0, 10),
  };
};

export function GrandLivreModal({ clientId, clientNom, base = 'clients', onClose }: {
  clientId: number; clientNom: string; base?: 'clients' | 'fournisseurs'; onClose: () => void;
}) {
  const [{ debut, fin }, setPeriode] = useState(moisCourant());
  const [data, setData]     = useState<GrandLivre | null>(null);
  const [loading, setLoading] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    const res = await api.get<GrandLivre>(`/${base}/${clientId}/grand-livre?debut=${debut}&fin=${fin}`);
    setLoading(false);
    if (res.success && res.data) setData(res.data);
  }, [base, clientId, debut, fin]);

  useEffect(() => { charger(); }, [charger]);

  const soldeCls = (n: number) => n < 0 ? 'text-red-600' : 'text-green-700';
  const sensLabel = data && data.solde_periode !== 0 ? (data.solde_periode > 0 ? 'Avance' : 'Dû') : '';

  const imprimer = () => {
    if (!data) return;
    const rows = data.lignes.map((l, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${fdate(l.date)}</td>
        <td>${l.texte ?? ''}</td>
        <td class="r green">${l.recu ? fcfa(l.recu) : ''}</td>
        <td class="r red">${l.paye ? fcfa(l.paye) : ''}</td>
        <td class="r">${fcfa(l.solde)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Grand livre — ${data.client.raison_sociale}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;padding:24px;font-size:12px}
        h1{font-size:16px;margin:0;text-align:center}
        h2{font-size:13px;margin:2px 0;text-align:center;font-weight:normal}
        .sub{text-align:center;font-weight:bold;margin-bottom:14px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #999;padding:5px 7px}
        th{background:#f3f3f3}
        .r{text-align:right}.c{text-align:center}
        .green{color:#1b7f3b}.red{color:#c0392b}
        .prev{background:#f3f3f3;font-weight:bold}
        .tot{margin-top:16px;width:60%;margin-left:auto;margin-right:auto}
      </style></head><body>
      <h1>Grand livre</h1>
      <h2>${data.client.raison_sociale}</h2>
      <div class="sub">${fdate(data.periode.debut)} jusqu'à : ${fdate(data.periode.fin)}</div>
      <table>
        <thead><tr><th></th><th>Date</th><th>Texte</th><th>Reçu</th><th>Payé</th><th>Solde</th></tr></thead>
        <tbody>
          <tr class="prev"><td colspan="5">Solde précédent</td><td class="r">${fcfa(data.solde_precedent)}</td></tr>
          ${rows}
        </tbody>
      </table>
      <table class="tot">
        <tr><td class="green"><b>Total Reçu</b></td><td class="r">${fcfa(data.total_recu)}</td></tr>
        <tr><td class="red"><b>Total Payé</b></td><td class="r">${fcfa(data.total_paye)}</td></tr>
        <tr><td><b>Solde</b></td><td class="r">${fcfa(Math.abs(data.solde_periode))} ${sensLabel}</td></tr>
        <tr><td><b>Solde précédent</b></td><td class="r">${fcfa(data.solde_precedent)}</td></tr>
        <tr><td><b>Solde final</b></td><td class="r">${fcfa(data.solde_final)}</td></tr>
      </table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <Modal open onClose={onClose} title={`Grand livre — ${clientNom}`} size="xl">
      <div className="space-y-4">
        {/* Période + actions */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Du</label>
            <input type="date" value={debut} onChange={e => setPeriode(p => ({ ...p, debut: e.target.value }))}
              className="text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#A8A49E] uppercase">Au</label>
            <input type="date" value={fin} onChange={e => setPeriode(p => ({ ...p, fin: e.target.value }))}
              className="text-xs px-3 py-2 border border-black/[0.10] rounded-lg bg-white outline-none font-mono" />
          </div>
          <button className="btn text-xs" onClick={charger}>Actualiser</button>
          <button className="btn btn-primary text-xs ml-auto" onClick={imprimer} disabled={!data}>↓ Imprimer / PDF</button>
        </div>

        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : data && (
          <>
            <div className="border border-black/[0.08] rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F8F7F4]">
                  <tr>
                    {['', 'Date', 'Texte', 'Reçu', 'Payé', 'Solde'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[#F2F0EB] border-t border-black/[0.06] font-medium">
                    <td colSpan={5} className="px-3 py-2 text-right text-[#6B6862]">Solde précédent</td>
                    <td className={`px-3 py-2 text-right font-mono ${soldeCls(data.solde_precedent)}`}>{fcfa(data.solde_precedent)}</td>
                  </tr>
                  {data.lignes.map((l, i) => (
                    <tr key={i} className="border-t border-black/[0.04]">
                      <td className="px-3 py-2 text-[#A8A49E]">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-[#6B6862] whitespace-nowrap">{fdate(l.date)}</td>
                      <td className="px-3 py-2">{l.texte}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{l.recu ? fcfa(l.recu) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">{l.paye ? fcfa(l.paye) : ''}</td>
                      <td className={`px-3 py-2 text-right font-mono ${soldeCls(l.solde)}`}>{fcfa(l.solde)}</td>
                    </tr>
                  ))}
                  {data.lignes.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-[#A8A49E] py-8">Aucun mouvement sur la période</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            <div className="max-w-sm ml-auto border border-black/[0.08] rounded-xl overflow-hidden">
              <div className="flex justify-between px-3 py-2 text-xs border-b border-black/[0.06]">
                <span className="font-medium text-green-700">Total Reçu</span>
                <span className="font-mono">{fcfa(data.total_recu)}</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-xs border-b border-black/[0.06]">
                <span className="font-medium text-red-600">Total Payé</span>
                <span className="font-mono">{fcfa(data.total_paye)}</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-xs border-b border-black/[0.06]">
                <span className="font-medium">Solde période</span>
                <span className="font-mono">{fcfa(Math.abs(data.solde_periode))} {sensLabel}</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-xs bg-[#F8F7F4]">
                <span className="font-medium">Solde final</span>
                <span className={`font-mono font-medium ${soldeCls(data.solde_final)}`}>{fcfa(data.solde_final)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
