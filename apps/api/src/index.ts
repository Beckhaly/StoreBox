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
import { requireAuth }   from './middleware/auth';
import { errorHandler }  from './middleware/errorHandler';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Publiques
app.use('/api/auth', authRouter);
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '2.0', ts: new Date() }));

// ── Protégées
app.use('/api', requireAuth);
app.use('/api/referentiels', referentielsRouter);
app.use('/api/societe',      societeRouter);
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/produits',     produitsRouter);
app.use('/api/clients',      clientsRouter);
app.use('/api/ventes',       ventesRouter);
app.use('/api/creances',     creancesRouter);
app.use('/api/dettes',       dettesRouter);
app.use('/api/echeances',    echeancesRouter);
app.use('/api/paiements',    paiementsRouter);
app.use('/api/fournisseurs', fournisseursRouter);
app.use('/api/achats',       achatsRouter);
app.use('/api/rapports',         rapportsRouter);
app.use('/api/rapports/avances', rapportsAvancesRouter);
app.use('/api/devis',            devisRouter);
app.use('/api/retours',          retoursRouter);
app.use('/api/bons-commande',    bonCommandeRouter);
app.use('/api/stock',            stockRouter);
app.use('/api/objectifs',        objectifsRouter);
app.use('/api/search',           searchRouter);
app.use('/api/depenses',         depensesRouter);
app.use('/api/pdf',              pdfRouter);
app.use('/api/notifications',notifRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/magasins',     magasinsRouter);
app.use('/api/caisse',       caisseRouter);

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
    const db = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'non configurée';
    console.log(`   DB   : ${db}\n`);
  });
}

export default app;
