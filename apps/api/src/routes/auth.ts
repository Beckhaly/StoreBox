import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { spAuthLogin } from '../lib/sp';
import { effectivePerms } from '@storebox/shared';

// Récupère les surcharges de droits individuelles d'un utilisateur (JSONB)
async function getOverride(userId: number) {
  const { rows } = await db.query('SELECT permissions_override FROM utilisateurs WHERE id=$1', [userId]);
  return rows[0]?.permissions_override ?? null;
}

const router = Router();
const JWT_SECRET     = process.env.JWT_SECRET || 'storebox-secret-change-in-prod';
const JWT_EXPIRES    = (process.env.JWT_EXPIRES || '8h') as `${number}${'s'|'m'|'h'|'d'}` | `${number}`;
const REFRESH_EXP    = '7d';
const MAX_TENTATIVES = 5;
const BLOCAGE_MIN    = 15;

function genJti() { return crypto.randomBytes(16).toString('hex'); }

async function saveSession(userId: number, jti: string, hours: number, ip: string, ua: string) {
  const exp = new Date(Date.now() + hours * 3_600_000);
  await db.query(
    `INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, jti, ip, ua, exp]
  );
}

async function audit(userId: number | null, action: string, details: object | null, ip: string) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [userId, action, details ? JSON.stringify(details) : null, ip]
  ).catch(() => {});
}

// POST /api/auth/login
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const ip = req.ip ?? '';
  const ua = req.headers['user-agent'] ?? '';

  if (!email || !password) return fail(res, 'Email et mot de passe requis', 400);

  // Appeler SP au lieu de requête SQL directe
  const user = await spAuthLogin(email.toLowerCase().trim());

  if (!user) {
    await audit(null, 'LOGIN_ECHEC', { email, motif: 'inconnu' }, ip);
    return fail(res, 'Identifiants incorrects', 401);
  }

  if (user.bloque_jusqu && new Date(user.bloque_jusqu) > new Date()) {
    const min = Math.ceil((new Date(user.bloque_jusqu).getTime() - Date.now()) / 60_000);
    return fail(res, `Compte bloqué. Réessayez dans ${min} min.`, 429);
  }

  if (!user.actif) return fail(res, 'Compte désactivé.', 403);

  const ok2 = await bcrypt.compare(password, user.password_hash);
  if (!ok2) {
    const t = user.tentatives_echec + 1;
    const bloque = t >= MAX_TENTATIVES ? new Date(Date.now() + BLOCAGE_MIN * 60_000) : null;
    await db.query(`UPDATE utilisateurs SET tentatives_echec=$1, bloque_jusqu=$2 WHERE id=$3`, [t, bloque, user.id]);
    await audit(user.id, 'LOGIN_ECHEC', { tentatives: t }, ip);
    if (bloque) return fail(res, `Trop de tentatives. Compte bloqué ${BLOCAGE_MIN} min.`, 429);
    return fail(res, `Mot de passe incorrect (${t}/${MAX_TENTATIVES})`, 401);
  }

  await db.query(`UPDATE utilisateurs SET tentatives_echec=0, bloque_jusqu=NULL, derniere_cnx=NOW() WHERE id=$1`, [user.id]);

  const magasin_ids  = user.magasin_ids  ?? [];
  const magasin_noms = user.magasin_noms ?? [];

  const perms = effectivePerms(user.permissions, await getOverride(user.id));

  const payload = { sub: user.id, email: user.email, nom: user.nom, prenom: user.prenom,
                    role: user.role_code, perms, magasin_ids };

  const jti  = genJti();
  const rJti = genJti();
  const token        = jwt.sign({ ...payload, jti },  JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh', jti: rJti }, JWT_SECRET, { expiresIn: REFRESH_EXP });

  await Promise.all([
    saveSession(user.id, jti,  8,    ip, ua),
    saveSession(user.id, rJti, 168,  ip, ua),
  ]);
  await audit(user.id, 'LOGIN_OK', { role: user.role_code }, ip);

  ok(res, {
    token, refreshToken, expiresIn: JWT_EXPIRES,
    user: { id: user.id, code: user.code, nom: user.nom, prenom: user.prenom,
            email: user.email, telephone: user.telephone,
            role: user.role_code, roleLabel: user.role_libelle, permissions: perms,
            magasin_ids, magasin_noms },
  });
}));

// POST /api/auth/refresh
router.post('/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  if (!refreshToken) return fail(res, 'refreshToken requis', 400);

  const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
  if (decoded.type !== 'refresh') return fail(res, 'Token invalide', 401);

  const { rows } = await db.query(
    `SELECT id FROM sessions WHERE token_jti=$1 AND revoked=FALSE AND expires_at > NOW()`,
    [decoded.jti]
  );
  if (!rows.length) return fail(res, 'Session expirée', 401);

  const { rows: users } = await db.query(
    `SELECT u.*, r.code AS role_code, r.permissions, vm.magasin_ids
     FROM utilisateurs u JOIN roles r ON r.id=u.role_id
     JOIN v_utilisateurs_magasins vm ON vm.utilisateur_id=u.id
     WHERE u.id=$1 AND u.actif=TRUE`,
    [decoded.sub]
  );
  if (!users.length) return fail(res, 'Utilisateur introuvable', 401);

  const u = users[0];
  const perms = effectivePerms(u.permissions, u.permissions_override);
  const jti   = genJti();
  const token = jwt.sign({ sub: u.id, email: u.email, nom: u.nom, prenom: u.prenom,
                           role: u.role_code, perms,
                           magasin_ids: u.magasin_ids ?? [], jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  await saveSession(u.id, jti, 8, req.ip ?? '', req.headers['user-agent'] ?? '');
  ok(res, { token, expiresIn: JWT_EXPIRES });
}));

// POST /api/auth/logout
router.post('/logout', wrap(async (req, res) => {
  const header = req.headers.authorization;
  if (header) {
    const decoded = jwt.decode(header.split(' ')[1]) as any;
    if (decoded?.jti) {
      await db.query(`UPDATE sessions SET revoked=TRUE WHERE token_jti=$1`, [decoded.jti]);
      await audit(decoded.sub, 'LOGOUT', null, req.ip ?? '');
    }
  }
  ok(res, { message: 'Déconnecté' });
}));

// GET /api/auth/me
router.get('/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.code, u.nom, u.prenom, u.email, u.telephone, u.derniere_cnx,
            u.permissions_override, vm.magasin_ids, vm.magasin_noms,
            r.code AS role, r.libelle AS role_libelle, r.permissions
     FROM utilisateurs u
     JOIN roles r ON r.id=u.role_id
     JOIN v_utilisateurs_magasins vm ON vm.utilisateur_id=u.id
     WHERE u.id=$1`,
    [req.user!.sub]
  );
  if (!rows.length) return fail(res, 'Introuvable', 404);
  ok(res, { ...rows[0], permissions: effectivePerms(rows[0].permissions, rows[0].permissions_override) });
}));

// POST /api/auth/change-password
router.post('/change-password', requireAuth, wrap(async (req, res) => {
  const { ancien, nouveau } = req.body as { ancien: string; nouveau: string };
  if (!ancien || !nouveau || nouveau.length < 8)
    return fail(res, 'Nouveau mot de passe trop court (min 8 caractères)', 400);

  const { rows } = await db.query(`SELECT password_hash FROM utilisateurs WHERE id=$1`, [req.user!.sub]);
  if (!(await bcrypt.compare(ancien, rows[0].password_hash)))
    return fail(res, 'Ancien mot de passe incorrect', 401);

  await db.query(`UPDATE utilisateurs SET password_hash=$1 WHERE id=$2`,
    [await bcrypt.hash(nouveau, 12), req.user!.sub]);
  await db.query(`UPDATE sessions SET revoked=TRUE WHERE user_id=$1`, [req.user!.sub]);
  await audit(req.user!.sub, 'CHANGE_PASSWORD', null, req.ip ?? '');
  ok(res, { message: 'Mot de passe modifié. Reconnectez-vous.' });
}));

export default router;
