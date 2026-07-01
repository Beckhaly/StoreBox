import 'dotenv/config';
import express       from 'express';
import cors          from 'cors';
import path          from 'path';

import authRouter          from './routes/auth';
import ventesRouter        from './routes/ventes';
import caisseRouter        from './routes/caisse';
import {
  dashboardRouter, produitsRouter, clientsRouter,
  creancesRouter,  dettesRouter,   echeancesRouter,
  paiementsRouter, fournisseursRouter, achatsRouter,
  rapportsRouter, pdfRouter, notifRouter, adminRouter, referentielsRouter,
  devisRouter, retoursRouter, bonCommandeRouter, stockRouter,
  objectifsRouter, searchRouter, rapportsAvancesRouter, depensesRouter,
  societeRouter, magasinsRouter,
} from './routes/index';
import { requireAuth, requirePerm } from './middleware/auth';
import { errorHandler }  from './middleware/errorHandler';
import { db }            from './lib/db';
import { rafraichirConfigNotif } from './services/notifications';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '5mb' })); // logos base64 (UI: max 2 Mo + ~33% encodage)

// ── Publiques
app.use('/api/auth', authRouter);
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '2.0', ts: new Date() }));

// Identité publique de la société (page de connexion) — champs non sensibles uniquement
app.get('/api/societe/public', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT nom, raison_sociale, logo_url FROM societe_parametres ORDER BY id DESC LIMIT 1`
    );
    res.json({ success: true, data: rows[0] ?? { nom: 'StoreBox' } });
  } catch {
    res.json({ success: true, data: { nom: 'StoreBox' } });
  }
});

// ── Protégées
app.use('/api', requireAuth);
// Dépendances partagées (dropdowns, sélecteur magasin) : lecture ouverte à tout
// utilisateur authentifié ; leurs mutations restent protégées dans chaque routeur.
app.use('/api/referentiels', referentielsRouter);
app.use('/api/societe',      societeRouter);
app.use('/api/magasins',     magasinsRouter);
app.use('/api/search',           searchRouter);
app.use('/api/objectifs',        objectifsRouter);
app.use('/api/pdf',              pdfRouter);
app.use('/api/notifications',    notifRouter);
// Modules-pages : accès verrouillé par droit (lecture minimale requise)
app.use('/api/dashboard',    requirePerm('dashboard'),    dashboardRouter);
app.use('/api/produits',     requirePerm('produits'),     produitsRouter);
app.use('/api/clients',      requirePerm('clients'),      clientsRouter);
app.use('/api/ventes',       requirePerm('ventes'),       ventesRouter);
app.use('/api/creances',     requirePerm('creances'),     creancesRouter);
app.use('/api/dettes',       requirePerm('dettes'),       dettesRouter);
app.use('/api/echeances',    requirePerm('echeances'),    echeancesRouter);
app.use('/api/paiements',    requirePerm('paiements'),    paiementsRouter);
app.use('/api/fournisseurs', requirePerm('fournisseurs'), fournisseursRouter);
app.use('/api/achats',       requirePerm('achats'),       achatsRouter);
app.use('/api/rapports',         requirePerm('rapports'), rapportsRouter);
app.use('/api/rapports/avances', requirePerm('rapports'), rapportsAvancesRouter);
app.use('/api/devis',            requirePerm('devis'),     devisRouter);
app.use('/api/retours',          requirePerm('retours'),   retoursRouter);
app.use('/api/bons-commande',    requirePerm('commandes'), bonCommandeRouter);
app.use('/api/stock',            requirePerm('stock'),     stockRouter);
app.use('/api/depenses',         requirePerm('depenses'),  depensesRouter);
app.use('/api/caisse',       requirePerm('caisse'),        caisseRouter);
app.use('/api/admin',        adminRouter);

// ── Frontend SPA (Vite) — servi depuis Express sur O2SWITCH
// Chercher d'abord les fichiers statiques (JS, CSS, images)
const webDistPath = path.join(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

// SPA fallback — toutes les routes inconnues → index.html (pour React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(webDistPath, 'index.html'));
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 StoreBox API → http://localhost:${PORT}`);
    console.log(`   Mode : ${process.env.NODE_ENV || 'development'}`);
    const dbUrl = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'non configurée';
    console.log(`   DB   : ${dbUrl}\n`);
    // Charger la config notifications (SMS/WA) depuis la société en DB
    rafraichirConfigNotif(db).catch(() => {});
  });
}

export default app;
