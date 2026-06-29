// ============================================================
// StoreBox — Service Notifications (SMS + WhatsApp)
// ============================================================
import axios from 'axios';

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'twilio';
const WA_PROVIDER  = process.env.WA_PROVIDER  || 'twilio';

// ─── NORMALISER NUMÉRO CI ────────────────────────────────────
export function normalizePhone(tel: string): string | null {
  if (!tel) return null;
  let n = tel.replace(/[\s\-().]/g, '');
  if (n.startsWith('+')) return n;
  if (n.startsWith('225')) return '+' + n;
  if (n.length === 10 && n.startsWith('0')) return '+225' + n.slice(1);
  if (n.length === 8) return '+225' + n;
  return '+' + n;
}

// ─── SMS ─────────────────────────────────────────────────────
export async function envoyerSMS(to: string, message: string) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Numéro invalide');
  switch (SMS_PROVIDER) {
    case 'twilio':    return sendTwilioSMS(phone, message);
    case 'orange_ci': return sendOrangeSMS(phone, message);
    case 'infobip':   return sendInfobipSMS(phone, message);
    default: throw new Error(`Provider SMS inconnu: ${SMS_PROVIDER}`);
  }
}

async function sendTwilioSMS(to: string, body: string) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (!sid || !token) throw new Error('Twilio non configuré');
  const params = new URLSearchParams({ To: to, From: from!, Body: body });
  const r = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    params.toString(),
    { auth: { username: sid, password: token }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { provider: 'twilio', sid: r.data.sid, status: r.data.status };
}

async function sendOrangeSMS(to: string, body: string) {
  const { ORANGE_SMS_API_KEY: key, ORANGE_SENDER: sender = 'StoreBox' } = process.env;
  const r = await axios.post(
    `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent('tel:'+sender)}/requests`,
    { outboundSMSMessageRequest: { address:[`tel:${to}`], senderName: sender, outboundSMSTextMessage:{ message:body } } },
    { headers: { Authorization: `Bearer ${key}` } }
  );
  return { provider: 'orange_ci', resourceURL: r.data?.outboundSMSMessageRequest?.resourceURL };
}

async function sendInfobipSMS(to: string, body: string) {
  const { INFOBIP_API_KEY: key, INFOBIP_BASE_URL: base, INFOBIP_FROM: from } = process.env;
  const r = await axios.post(`${base}/sms/2/text/advanced`,
    { messages: [{ from, destinations:[{ to }], text: body }] },
    { headers: { Authorization: `App ${key}` } }
  );
  return { provider: 'infobip', messageId: r.data?.messages?.[0]?.messageId };
}

// ─── WHATSAPP ────────────────────────────────────────────────
export async function envoyerWhatsApp(to: string, message: string) {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Numéro invalide');
  switch (WA_PROVIDER) {
    case 'twilio':  return sendTwilioWA(phone, message);
    case 'infobip': return sendInfobipWA(phone, message);
    default: throw new Error(`Provider WA inconnu: ${WA_PROVIDER}`);
  }
}

async function sendTwilioWA(to: string, body: string) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WA_FROM: from } = process.env;
  if (!sid || !token) throw new Error('Twilio non configuré');
  const params = new URLSearchParams({ To: `whatsapp:${to}`, From: from!, Body: body });
  const r = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    params.toString(),
    { auth: { username: sid, password: token }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { provider: 'twilio_wa', sid: r.data.sid };
}

async function sendInfobipWA(to: string, body: string) {
  const { INFOBIP_API_KEY: key, INFOBIP_BASE_URL: base, INFOBIP_WA_FROM: from } = process.env;
  const r = await axios.post(`${base}/whatsapp/1/message/template`,
    { type:'text', from, to, content:{ text: body } },
    { headers: { Authorization: `App ${key}` } }
  );
  return { provider: 'infobip_wa', messageId: r.data?.messages?.[0]?.messageId };
}

// ─── TEMPLATES ───────────────────────────────────────────────
const fcfa = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' FCFA';
const fdate = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR');

export const TEMPLATES = {
  confirmationVente: (d: any) =>
`Bonjour ${d.client_nom},
Commande N° ${d.numero} enregistrée chez StoreBox.
Montant : ${fcfa(d.total_ttc)}
${d.date_echeance ? `Échéance : ${fdate(d.date_echeance)}` : 'Règlement : Comptant'}
Merci. StoreBox — +225 07 00 00 00`.trim(),

  relance1: (d: any) =>
`Bonjour ${d.client_nom},
Rappel : facture N° ${d.numero} de ${fcfa(d.solde_restant)} était due le ${fdate(d.date_echeance)}.
Merci de régulariser. StoreBox — +225 07 00 00 00`.trim(),

  relance2: (d: any) =>
`Bonjour ${d.client_nom},
Facture N° ${d.numero} toujours impayée.
Montant : ${fcfa(d.solde_restant)} — Retard : ${d.jours_retard}j
Sans règlement sous 72h : suspension de compte et contentieux.
StoreBox — +225 07 00 00 00`.trim(),

  confirmationPaiement: (d: any) =>
`Bonjour ${d.client_nom},
Paiement de ${fcfa(d.montant)} reçu le ${fdate(d.date)}.
Facture : ${d.numero}
${d.solde_restant > 0 ? `Solde restant : ${fcfa(d.solde_restant)}` : 'Facture soldée.'}
Merci. StoreBox`.trim(),

  alerteStockInterne: (d: any) =>
`⚠️ ALERTE STOCK StoreBox
Produit : ${d.designation}
Réf : ${d.reference}
Stock : ${d.stock} u. (seuil : ${d.stock_alerte})`.trim(),

  alerteExpiration: (d: { jours: number; lignes: string[] }) =>
`⏳ ALERTE PÉREMPTION StoreBox
${d.lignes.length} lot(s) à écouler sous ${d.jours}j :
${d.lignes.join('\n')}`.trim(),
};

// ─── SERVICE ─────────────────────────────────────────────────
export class NotificationService {
  async confirmerVente(db: any, vente: any, client: any) {
    const msg = TEMPLATES.confirmationVente({ client_nom: client.raison_sociale, ...vente });
    const r: any = {};
    if (client.telephone) {
      r.sms = await envoyerSMS(client.telephone, msg).catch(e => ({ error: e.message }));
      await this.log(db, 'confirmation_vente', 'sms', client.telephone, msg, 'envoye', vente.numero);
      if (client.type_client === 'grossiste') {
        r.whatsapp = await envoyerWhatsApp(client.telephone, msg).catch(e => ({ error: e.message }));
      }
    }
    return r;
  }

  async relancerCreance(db: any, creance: any, client: any, niveau = 1) {
    const tpl = niveau >= 2 ? TEMPLATES.relance2 : TEMPLATES.relance1;
    const msg = tpl({ client_nom: client.raison_sociale, ...creance });
    const r: any = {};
    if (client.telephone) {
      r.sms = await envoyerSMS(client.telephone, msg).catch(e => ({ error: e.message }));
      await this.log(db, `relance_${niveau}`, 'sms', client.telephone, msg, 'envoye', creance.numero);
      if (niveau >= 2) {
        r.whatsapp = await envoyerWhatsApp(client.telephone, msg).catch(e => ({ error: e.message }));
      }
    }
    return r;
  }

  async confirmerPaiement(db: any, paiement: any, vente: any, client: any) {
    const msg = TEMPLATES.confirmationPaiement({
      client_nom: client.raison_sociale, montant: paiement.montant,
      date: paiement.date_paiement, numero: vente.numero, solde_restant: vente.solde_restant,
    });
    if (client.telephone) {
      await envoyerSMS(client.telephone, msg).catch(() => {});
    }
  }

  async alerteStock(db: any, produit: any) {
    const msg = TEMPLATES.alerteStockInterne(produit);
    const tel = process.env.GERANT_TEL || '+22507000000';
    await envoyerSMS(tel, msg).catch(() => {});
    await envoyerWhatsApp(tel, msg).catch(() => {});
  }

  // Alerte interne : lots proches de péremption (digest au gérant)
  async alerteExpiration(db: any, jours = 7, magasin_id: number | null = null) {
    const params: any[] = [jours];
    let q = `SELECT designation, reference, quantite, jours_restants, magasin_nom
             FROM v_lots_expirant WHERE jours_restants <= $1`;
    if (magasin_id) { params.push(magasin_id); q += ` AND magasin_id=$${params.length}`; }
    q += ` ORDER BY jours_restants ASC LIMIT 20`;
    const { rows } = await db.query(q, params);
    if (!rows.length) return { lots: 0, envoye: false };

    const etat = (j: number) =>
      j < 0 ? `périmé depuis ${Math.abs(j)}j`
            : j === 0 ? 'périme aujourd’hui'
                      : `dans ${j}j`;
    const lignes = rows.map((r: any) =>
      `• ${r.designation} — ${r.quantite} (${etat(Number(r.jours_restants))})`);
    const msg = TEMPLATES.alerteExpiration({ jours, lignes });
    const tel = process.env.GERANT_TEL || '+22507000000';
    await envoyerSMS(tel, msg).catch(() => {});
    await envoyerWhatsApp(tel, msg).catch(() => {});
    await this.log(db, 'alerte_expiration', 'sms', tel, msg, 'envoye', `EXP-${jours}j`);
    return { lots: rows.length, envoye: true, message: msg };
  }

  async campagneRelances(db: any) {
    const { rows } = await db.query(`
      SELECT cr.*, c.raison_sociale, c.telephone, c.type_client
      FROM v_creances_clients cr JOIN clients c ON c.id=cr.client_id
      WHERE cr.jours_retard > 0 AND c.telephone IS NOT NULL
      ORDER BY cr.jours_retard DESC`);
    const resultats = [];
    for (const cr of rows) {
      const niveau = (cr.jours_retard ?? 0) > 30 ? 2 : 1;
      const r = await this.relancerCreance(db, cr, { raison_sociale: cr.raison_sociale, telephone: cr.telephone, type_client: cr.type_client }, niveau);
      resultats.push({ numero: cr.numero, client: cr.raison_sociale, niveau, ...r });
      await new Promise(res => setTimeout(res, 200));
    }
    return resultats;
  }

  private async log(db: any, type: string, canal: string, dest: string, msg: string, statut: string, ref: string) {
    await db.query(
      `INSERT INTO notifications_log (type,canal,destinataire,message,statut,ref_doc) VALUES ($1,$2,$3,$4,$5,$6)`,
      [type, canal, dest, msg, statut, ref]
    ).catch(() => {});
  }
}
