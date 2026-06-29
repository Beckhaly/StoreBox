// ============================================================
// StoreBox — Service Notifications (SMS + WhatsApp)
// ============================================================
import axios from 'axios';

// ─── CONFIGURATION (env par défaut, surchargée par la société en DB) ──
const cfg = {
  sms_actif:    true,
  wa_actif:     true,
  sms_provider: process.env.SMS_PROVIDER || 'twilio',
  wa_provider:  process.env.WA_PROVIDER  || 'twilio',
  gerant_tel:   process.env.GERANT_TEL   || '+22507000000',
  twilio_sid:     process.env.TWILIO_ACCOUNT_SID || '',
  twilio_token:   process.env.TWILIO_AUTH_TOKEN  || '',
  twilio_from:    process.env.TWILIO_FROM        || '',
  twilio_wa_from: process.env.TWILIO_WA_FROM     || '',
  orange_key:     process.env.ORANGE_SMS_API_KEY || '',
  orange_sender:  process.env.ORANGE_SENDER      || 'StoreBox',
  infobip_key:    process.env.INFOBIP_API_KEY    || '',
  infobip_base:   process.env.INFOBIP_BASE_URL   || '',
  infobip_from:   process.env.INFOBIP_FROM       || '',
  infobip_wa_from:process.env.INFOBIP_WA_FROM    || '',
};

// Recharge la config depuis societe_parametres (valeurs non vides → priorité sur l'env)
export async function rafraichirConfigNotif(db: any): Promise<void> {
  try {
    const { rows: [s] } = await db.query('SELECT * FROM societe_parametres ORDER BY id DESC LIMIT 1');
    if (!s) return;
    const str = (col: string, key: keyof typeof cfg) => {
      if (s[col] !== null && s[col] !== undefined && s[col] !== '') (cfg as any)[key] = s[col];
    };
    if (s.sms_actif !== null && s.sms_actif !== undefined) cfg.sms_actif = s.sms_actif;
    if (s.wa_actif  !== null && s.wa_actif  !== undefined) cfg.wa_actif  = s.wa_actif;
    str('sms_provider', 'sms_provider'); str('wa_provider', 'wa_provider');
    str('gerant_tel', 'gerant_tel');
    str('twilio_account_sid', 'twilio_sid'); str('twilio_auth_token', 'twilio_token');
    str('twilio_from', 'twilio_from');       str('twilio_wa_from', 'twilio_wa_from');
    str('orange_sms_api_key', 'orange_key'); str('orange_sender', 'orange_sender');
    str('infobip_api_key', 'infobip_key');   str('infobip_base_url', 'infobip_base');
    str('infobip_from', 'infobip_from');     str('infobip_wa_from', 'infobip_wa_from');
  } catch {
    // table absente / pas encore migrée → on garde la config env
  }
}

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
  if (!cfg.sms_actif) return { provider: 'desactive', skipped: true };
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Numéro invalide');
  switch (cfg.sms_provider) {
    case 'twilio':    return sendTwilioSMS(phone, message);
    case 'orange_ci': return sendOrangeSMS(phone, message);
    case 'infobip':   return sendInfobipSMS(phone, message);
    default: throw new Error(`Provider SMS inconnu: ${cfg.sms_provider}`);
  }
}

async function sendTwilioSMS(to: string, body: string) {
  const { twilio_sid: sid, twilio_token: token, twilio_from: from } = cfg;
  if (!sid || !token) throw new Error('Twilio non configuré');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const r = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    params.toString(),
    { auth: { username: sid, password: token }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { provider: 'twilio', sid: r.data.sid, status: r.data.status };
}

async function sendOrangeSMS(to: string, body: string) {
  const { orange_key: key, orange_sender: sender } = cfg;
  const r = await axios.post(
    `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent('tel:'+sender)}/requests`,
    { outboundSMSMessageRequest: { address:[`tel:${to}`], senderName: sender, outboundSMSTextMessage:{ message:body } } },
    { headers: { Authorization: `Bearer ${key}` } }
  );
  return { provider: 'orange_ci', resourceURL: r.data?.outboundSMSMessageRequest?.resourceURL };
}

async function sendInfobipSMS(to: string, body: string) {
  const { infobip_key: key, infobip_base: base, infobip_from: from } = cfg;
  const r = await axios.post(`${base}/sms/2/text/advanced`,
    { messages: [{ from, destinations:[{ to }], text: body }] },
    { headers: { Authorization: `App ${key}` } }
  );
  return { provider: 'infobip', messageId: r.data?.messages?.[0]?.messageId };
}

// ─── WHATSAPP ────────────────────────────────────────────────
export async function envoyerWhatsApp(to: string, message: string) {
  if (!cfg.wa_actif) return { provider: 'desactive', skipped: true };
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Numéro invalide');
  switch (cfg.wa_provider) {
    case 'twilio':  return sendTwilioWA(phone, message);
    case 'infobip': return sendInfobipWA(phone, message);
    default: throw new Error(`Provider WA inconnu: ${cfg.wa_provider}`);
  }
}

async function sendTwilioWA(to: string, body: string) {
  const { twilio_sid: sid, twilio_token: token, twilio_wa_from: from } = cfg;
  if (!sid || !token) throw new Error('Twilio non configuré');
  const params = new URLSearchParams({ To: `whatsapp:${to}`, From: from, Body: body });
  const r = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    params.toString(),
    { auth: { username: sid, password: token }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { provider: 'twilio_wa', sid: r.data.sid };
}

async function sendInfobipWA(to: string, body: string) {
  const { infobip_key: key, infobip_base: base, infobip_wa_from: from } = cfg;
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
    const tel = cfg.gerant_tel;
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
    const tel = cfg.gerant_tel;
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
