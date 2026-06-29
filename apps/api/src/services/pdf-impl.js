// ============================================================
// TéléPro CI — Génération de PDFs (factures, devis, relevés)
// ============================================================

const PDFDocument = require('pdfkit');

// ─── HELPERS ─────────────────────────────────────────────────
const fcfa  = n => {
  const num = Math.round(Number(n) || 0);
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
};
const fdate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const num   = v => Number(v) || 0;   // cast DB string → number

const COLORS = {
  primary:   '#1B5FD6',
  dark:      '#1A1917',
  gray:      '#6B6862',
  lightGray: '#F2F0EB',
  border:    '#E0DDD8',
  red:       '#C53030',
  green:     '#1A7A4A',
  white:     '#FFFFFF',
};

// ─── UTILITAIRES DESSIN ───────────────────────────────────────

function roundRect(doc, x, y, w, h, r, fill) {
  doc.roundedRect(x, y, w, h, r).fill(fill);
}

function hline(doc, y, x1 = 50, x2 = 545) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
}

// ─── EN-TÊTE ─────────────────────────────────────────────────

function drawHeader(doc, type, numero, date, echeance) {
  // Bandeau sombre
  roundRect(doc, 0, 0, 595, 85, 0, COLORS.dark);

  // Logo / Société
  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.white)
     .text('TéléPro CI', 50, 24, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('rgba(255,255,255,0.55)')
     .text('Vente téléphones & accessoires — Abidjan, Côte d\'Ivoire', 50, 46, { lineBreak: false })
     .text('Tél : +225 07 00 00 00  |  contact@telepro.ci', 50, 58, { lineBreak: false });

  // Type document + numéro
  const typeLabel = { facture: 'FACTURE', devis: 'DEVIS', releve: 'RELEVÉ' }[type] || type.toUpperCase();
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.white)
     .text(typeLabel, 370, 18, { width: 175, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.65)')
     .text(numero, 370, 44, { width: 175, align: 'right', lineBreak: false })
     .text(`Émis le ${fdate(date)}`, 370, 56, { width: 175, align: 'right', lineBreak: false });
  if (echeance)
    doc.text(`Échéance : ${fdate(echeance)}`, 370, 68, { width: 175, align: 'right', lineBreak: false });
}

// ─── SECTION ÉMETTEUR / DESTINATAIRE (côte à côte) ───────────

function drawParties(doc, client) {
  const yBase = 100;
  const ROW_H = 80;

  // ── Émetteur (gauche) ──
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.gray)
     .text('DE', 50, yBase, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark)
     .text('TéléPro CI SARL', 50, yBase + 12, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray)
     .text('Zone Industrielle — Plateau, Abidjan', 50, yBase + 25, { lineBreak: false })
     .text('RC : CI-ABJ-2022-B-12345  |  NCC : 1234567A', 50, yBase + 37, { lineBreak: false })
     .text('Tél : +225 07 00 00 00  |  contact@telepro.ci', 50, yBase + 49, { lineBreak: false });

  // ── Destinataire (droite, fond grisé) ──
  const x = 310;
  roundRect(doc, x, yBase - 4, 235, ROW_H, 6, COLORS.lightGray);

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.gray)
     .text('À', x + 12, yBase + 2, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark)
     .text(client.raison_sociale || '—', x + 12, yBase + 14, { width: 210, lineBreak: false });

  let yDest = yBase + 28;
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray);
  if (client.adresse) {
    doc.text(client.adresse, x + 12, yDest, { width: 210, lineBreak: false });
    yDest += 12;
  }
  if (client.ville) {
    doc.text(client.ville, x + 12, yDest, { width: 210, lineBreak: false });
    yDest += 12;
  }
  if (client.telephone) {
    doc.text(`Tél : ${client.telephone}`, x + 12, yDest, { width: 210, lineBreak: false });
    yDest += 12;
  }
  if (client.email) {
    doc.text(client.email, x + 12, yDest, { width: 210, lineBreak: false });
  }

  return yBase + ROW_H + 8; // y après les deux blocs
}

// ─── TABLEAU LIGNES ───────────────────────────────────────────

function drawLignes(doc, lignes, yStart) {
  // Colonnes : Désignation | Réf. | Qté | Prix unit. | Remise | Total HT
  const cols = [
    { x: 50,  w: 160, label: 'Désignation',  align: 'left'  },
    { x: 210, w: 70,  label: 'Référence',    align: 'left'  },
    { x: 280, w: 40,  label: 'Qté',          align: 'right' },
    { x: 320, w: 85,  label: 'Prix unit.',   align: 'right' },
    { x: 405, w: 50,  label: 'Remise',       align: 'right' },
    { x: 455, w: 90,  label: 'Total HT',     align: 'right' },
  ];

  // En-tête tableau
  roundRect(doc, 50, yStart, 495, 22, 3, COLORS.primary);
  cols.forEach(c => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
       .text(c.label, c.x + 3, yStart + 7, { width: c.w - 6, align: c.align, lineBreak: false });
  });

  let y = yStart + 26;
  lignes.forEach((l, idx) => {
    if (y > 700) { doc.addPage(); y = 60; }

    // Fond alterné
    if (idx % 2 === 0) roundRect(doc, 50, y - 2, 495, 19, 2, '#FAFAF8');

    const remiseMontant = Math.round(num(l.quantite) * num(l.prix_unitaire) * (num(l.remise_pct) || 0) / 100);
    const totalLigne = num(l.total_ligne) || Math.round(num(l.quantite) * num(l.prix_unitaire) * (1 - (num(l.remise_pct) || 0) / 100));
    const remise = num(l.remise_pct) > 0 ? `${l.remise_pct}%` : '—';
    const vals = [
      l.designation || l.produit || '—',
      l.reference || '—',
      String(l.quantite || 0),
      fcfa(num(l.prix_unitaire)),
      remise,
      fcfa(totalLigne),
    ];

    cols.forEach((c, i) => {
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.dark)
         .text(vals[i], c.x + 3, y, { width: c.w - 6, align: c.align, lineBreak: false });
    });
    y += 19;
  });

  hline(doc, y + 3);
  return y + 8;
}

// ─── BLOC TOTAUX ──────────────────────────────────────────────

function drawTotaux(doc, vente, yHint) {
  const x     = 345;
  const wLbl  = 105;
  const wVal  = 90;
  let y       = yHint;

  const sousTotal    = num(vente.sous_total);
  const remiseMt     = num(vente.remise_montant);
  const remisePct    = num(vente.remise_pct);
  const tvaPct       = num(vente.tva_pct) || 18;
  const tvaMontant   = num(vente.tva_montant);
  const totalTtc     = num(vente.total_ttc);
  const montantPaye  = num(vente.montant_paye);
  const soldeRestant = num(vente.solde_restant);

  const lignesTotaux = [
    ['Sous-total HT',      fcfa(sousTotal)],
    remiseMt > 0 ? [`Remise (${remisePct}%)`, `- ${fcfa(remiseMt)}`] : null,
    [`TVA (${tvaPct}%)`,   fcfa(tvaMontant)],
  ].filter(Boolean);

  lignesTotaux.forEach(([label, val]) => {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray)
       .text(label, x, y, { width: wLbl, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark)
       .text(val, x + wLbl, y, { width: wVal, align: 'right', lineBreak: false });
    y += 16;
  });

  hline(doc, y + 2, x, 545);
  y += 7;

  // Total TTC
  roundRect(doc, x - 4, y - 3, 204, 26, 4, COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.white)
     .text('TOTAL TTC', x, y + 4, { width: wLbl, lineBreak: false })
     .text(fcfa(totalTtc), x + wLbl, y + 4, { width: wVal, align: 'right', lineBreak: false });
  y += 34;

  // Payé (si > 0 et < total)
  if (montantPaye > 0 && soldeRestant > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray)
       .text('Dont payé', x, y, { width: wLbl, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.green)
       .text(fcfa(montantPaye), x + wLbl, y, { width: wVal, align: 'right', lineBreak: false });
    y += 16;
  }

  // Solde restant / PAYÉ
  if (soldeRestant > 0) {
    roundRect(doc, x - 4, y, 204, 22, 4, '#FDEDED');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.red)
       .text('Reste à payer', x, y + 6, { width: wLbl, lineBreak: false })
       .text(fcfa(soldeRestant), x + wLbl, y + 6, { width: wVal, align: 'right', lineBreak: false });
  } else {
    roundRect(doc, x - 4, y, 204, 22, 4, '#E6F5EC');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.green)
       .text('✓ INTÉGRALEMENT PAYÉ', x, y + 6, { width: 200, align: 'center', lineBreak: false });
  }

  return y + 30;
}

// ─── PIED DE PAGE ─────────────────────────────────────────────

function drawFooter(doc) {
  const y = 782;
  hline(doc, y - 6);
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.gray)
     .text(
       'TéléPro CI SARL — RC : CI-ABJ-2022-B-12345 — NCC : 1234567A — TVA : CI-20-23456',
       50, y, { width: 495, align: 'center', lineBreak: false }
     )
     .text(
       'Tout article vendu ne peut être ni repris ni échangé sans accord préalable. Pénalité de retard : 1,5%/mois.',
       50, y + 10, { width: 495, align: 'center', lineBreak: false }
     );
}

// ─── GÉNÉRATION FACTURE ───────────────────────────────────────

async function genererFacture(vente, client, lignes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title:   `Facture ${vente.numero}`,
        Author:  'TéléPro CI',
        Subject: `Facture client — ${client.raison_sociale}`,
      },
    });

    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // En-tête
    drawHeader(doc, 'facture', vente.numero, vente.date_vente, vente.date_echeance);
    let y = drawParties(doc, client);

    // Infos vente (sous les deux blocs)
    const typeLabel  = vente.type_vente === 'gros' ? 'Vente en gros (B2B)' : 'Vente au détail (B2C)';
    const moyenLabel = vente.moyen_paiement || 'À préciser';

    doc.font('Helvetica').fontSize(8.5);
    doc.fillColor(COLORS.gray).text('Type de vente :', 50, y, { lineBreak: false });
    doc.fillColor(COLORS.dark).text(typeLabel, 155, y, { lineBreak: false });
    y += 13;
    doc.fillColor(COLORS.gray).text('Mode de règlement :', 50, y, { lineBreak: false });
    doc.fillColor(COLORS.dark).text(moyenLabel, 155, y, { lineBreak: false });
    y += 20;

    // Lignes produits
    y = drawLignes(doc, lignes, y);
    y += 12;

    // Notes (gauche) + Totaux (droite)
    if (vente.notes) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.gray)
         .text('NOTES', 50, y, { lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.dark)
         .text(vente.notes, 50, y + 12, { width: 240, lineGap: 2 });
    }

    drawTotaux(doc, vente, y);
    drawFooter(doc);
    doc.end();
  });
}

// ─── GÉNÉRATION DEVIS ─────────────────────────────────────────

async function genererDevis(devis, client, lignes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'devis', devis.numero, devis.date_devis, devis.date_validite);
    let y = drawParties(doc, client);

    // Info validité
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray)
       .text('Validité du devis :', 50, y, { lineBreak: false });
    doc.fillColor(COLORS.dark)
       .text(fdate(devis.date_validite) || '30 jours', 155, y, { lineBreak: false });
    y += 20;

    y = drawLignes(doc, lignes, y);
    y += 12;
    drawTotaux(doc, devis, y);

    // Mention bas de page
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray)
       .text(
         'Ce devis est valable sous réserve de disponibilité des stocks. Pour accord, veuillez nous retourner ce document signé.',
         50, 730, { width: 495, align: 'center', lineBreak: false }
       );

    drawFooter(doc);
    doc.end();
  });
}

// ─── RELEVÉ DE COMPTE CLIENT ──────────────────────────────────

async function genererReleveClient(client, creances, periode) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const numero = `REL-${client.code}-${new Date().toISOString().slice(0, 7)}`;
    drawHeader(doc, 'releve', numero, new Date(), null);

    // Titre
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark)
       .text('RELEVÉ DE COMPTE CLIENT', 50, 96, { width: 495, align: 'center', lineBreak: false });
    if (periode) {
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray)
         .text(`Période : ${periode}`, 50, 112, { width: 495, align: 'center', lineBreak: false });
    }

    // Bloc destinataire (droite uniquement pour relevé)
    const xDest = 310;
    roundRect(doc, xDest, 95, 235, 78, 6, COLORS.lightGray);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray)
       .text('CLIENT', xDest + 12, 103, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark)
       .text(client.raison_sociale, xDest + 12, 115, { width: 210, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray);
    let yc = 129;
    if (client.telephone) { doc.text(`Tél : ${client.telephone}`, xDest + 12, yc, { lineBreak: false }); yc += 12; }
    if (client.email)     { doc.text(client.email, xDest + 12, yc, { lineBreak: false }); yc += 12; }
    if (client.ville)     { doc.text(client.ville, xDest + 12, yc, { lineBreak: false }); }

    // Résumé financier
    const totalDu  = creances.reduce((s, c) => s + num(c.solde_restant), 0);
    const enRetard = creances.filter(c => num(c.jours_retard) > 0)
                             .reduce((s, c) => s + num(c.solde_restant), 0);

    let y = 185;
    roundRect(doc, 50, y, 495, 52, 6, COLORS.lightGray);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.dark)
       .text(fcfa(totalDu), 50, y + 8, { width: 495, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray)
       .text('SOLDE TOTAL DÛ', 50, y + 34, { width: 495, align: 'center', lineBreak: false });
    if (enRetard > 0) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.red)
         .text(`dont ${fcfa(enRetard)} en retard de paiement`, 50, y + 46, { width: 495, align: 'center', lineBreak: false });
    }
    y += 62;

    // Tableau créances
    const cols  = [
      { x: 50,  w: 75,  label: 'Facture',     align: 'left'  },
      { x: 125, w: 90,  label: 'Date',         align: 'left'  },
      { x: 215, w: 95,  label: 'Montant TTC',  align: 'right' },
      { x: 310, w: 90,  label: 'Échéance',     align: 'left'  },
      { x: 400, w: 80,  label: 'Solde dû',     align: 'right' },
      { x: 480, w: 65,  label: 'Statut',       align: 'right' },
    ];

    roundRect(doc, 50, y, 495, 20, 3, COLORS.dark);
    cols.forEach(c => {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
         .text(c.label, c.x + 3, y + 6, { width: c.w - 6, align: c.align, lineBreak: false });
    });
    y += 24;

    creances.forEach((cr, idx) => {
      if (y > 720) { doc.addPage(); y = 50; }
      if (idx % 2 === 0) roundRect(doc, 50, y - 2, 495, 18, 2, '#FAFAF8');

      const jr = num(cr.jours_retard);
      const statutColor = jr > 30 ? COLORS.red : jr > 0 ? '#C47B0A' : COLORS.green;
      const statutLabel = jr > 30 ? 'Contentieux' : jr > 0 ? `${jr}j retard` : 'En cours';

      const vals = [
        cr.numero,
        fdate(cr.date_vente),
        fcfa(num(cr.total_ttc)),
        fdate(cr.date_echeance),
        fcfa(num(cr.solde_restant)),
        '',
      ];

      cols.forEach((c, i) => {
        if (i < 5) {
          doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.dark)
             .text(vals[i], c.x + 3, y, { width: c.w - 6, align: c.align, lineBreak: false });
        } else {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statutColor)
             .text(statutLabel, c.x + 3, y, { width: c.w - 6, align: 'right', lineBreak: false });
        }
      });
      y += 18;
    });

    hline(doc, y + 4);
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark)
       .text('TOTAL DÛ', 310 + 3, y, { width: 90 - 6, align: 'right', lineBreak: false })
       .text(fcfa(totalDu), 400 + 3, y, { width: 80 - 6, align: 'right', lineBreak: false });

    y += 30;
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.gray)
       .text(
         'Merci de bien vouloir régler le montant dû dans les meilleurs délais. Pour tout litige, contactez notre service comptabilité.',
         50, y, { width: 495, align: 'center' }
       );

    drawFooter(doc);
    doc.end();
  });
}

// ─── ROUTES EXPRESS ───────────────────────────────────────────
const express = require('express');
const { Pool } = require('pg');
const router  = express.Router();
const pool2   = new Pool({ connectionString: process.env.DATABASE_URL });
const db2     = { query: (t, p) => pool2.query(t, p) };

// GET /api/pdf/facture/:id
router.get('/facture/:id', async (req, res) => {
  try {
    const { rows: ventes } = await db2.query(
      `SELECT v.*, c.raison_sociale, c.adresse, c.ville, c.telephone, c.email, c.code AS client_code,
              mp.nom AS moyen_paiement
       FROM ventes v
       JOIN clients c ON c.id = v.client_id
       LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!ventes.length) return res.status(404).json({ error: 'Vente non trouvée' });

    const { rows: lignes } = await db2.query(
      `SELECT vl.*, p.designation, p.reference
       FROM ventes_lignes vl
       JOIN produits p ON p.id = vl.produit_id
       WHERE vl.vente_id = $1
       ORDER BY vl.id`,
      [req.params.id]
    );

    const v = ventes[0];
    const client = {
      raison_sociale: v.raison_sociale,
      adresse:        v.adresse,
      ville:          v.ville,
      telephone:      v.telephone,
      email:          v.email,
      code:           v.client_code,
    };

    const pdf = await genererFacture(v, client, lignes);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="Facture-${v.numero}.pdf"`,
      'Content-Length':      pdf.length,
    });
    res.send(pdf);
  } catch (e) {
    console.error('[PDF facture]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pdf/devis/:id
router.get('/devis/:id', async (req, res) => {
  try {
    const { rows: devisRows } = await db2.query(
      `SELECT d.*, c.raison_sociale, c.adresse, c.ville, c.telephone, c.email, c.code AS client_code
       FROM devis d
       JOIN clients c ON c.id = d.client_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!devisRows.length) return res.status(404).json({ error: 'Devis non trouvé' });

    const { rows: lignes } = await db2.query(
      `SELECT dl.*, p.reference
       FROM devis_lignes dl
       LEFT JOIN produits p ON p.id = dl.produit_id
       WHERE dl.devis_id = $1
       ORDER BY dl.id`,
      [req.params.id]
    );

    const d = devisRows[0];
    const client = {
      raison_sociale: d.raison_sociale,
      adresse:        d.adresse,
      ville:          d.ville,
      telephone:      d.telephone,
      email:          d.email,
      code:           d.client_code,
    };

    const pdf = await genererDevis(d, client, lignes);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="Devis-${d.numero}.pdf"`,
      'Content-Length':      pdf.length,
    });
    res.send(pdf);
  } catch (e) {
    console.error('[PDF devis]', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pdf/releve/:clientId
router.get('/releve/:clientId', async (req, res) => {
  try {
    const { rows: clients } = await db2.query(
      'SELECT * FROM clients WHERE id = $1',
      [req.params.clientId]
    );
    if (!clients.length) return res.status(404).json({ error: 'Client non trouvé' });

    const { rows: creances } = await db2.query(
      'SELECT * FROM v_creances_clients WHERE client_id = $1 ORDER BY date_echeance',
      [req.params.clientId]
    );

    const pdf = await genererReleveClient(clients[0], creances, null);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="Releve-${clients[0].code}.pdf"`,
      'Content-Length':      pdf.length,
    });
    res.send(pdf);
  } catch (e) {
    console.error('[PDF relevé]', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, genererFacture, genererDevis, genererReleveClient };
