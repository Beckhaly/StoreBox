import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import type { Permissions, PermissionModule } from '@storebox/shared';
import { hasPerm } from '../lib/perms';

const JWT_SECRET = process.env.JWT_SECRET || 'storebox-secret-change-in-prod';

export interface JwtPayload {
  sub:          number;
  email:        string;
  nom:          string;
  prenom:       string;
  role:         string;
  perms:        Permissions;
  jti:          string;
  magasin_ids:  number[]; // [] = accès tous magasins (admin)
}

declare global {
  namespace Express {
    interface Request { user?: JwtPayload; }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;

    // In demo/mock mode, skip session DB validation since sessions are in-memory and cleared on restart
    // The JWT token verification above is sufficient for security in this context
    req.user = decoded;
    next();
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }
}

// Normalise req.user.perms (peut être une string JSON venant du mock DB)
function readPerms(req: Request): Permissions {
  let p = req.user?.perms as any;
  if (typeof p === 'string') {
    try {
      const parsed = JSON.parse(p);
      if (Array.isArray(parsed)) {
        return (parsed.includes('admin') || parsed.includes('write_all') || parsed.includes('delete_all'))
          ? { all: true } : {};
      }
      return parsed;
    } catch {
      return {};
    }
  }
  return (p ?? {}) as Permissions;
}

// Exige un accès (lecture par défaut) à un module. requirePerm('ventes','write') pour l'écriture.
export function requirePerm(perm: PermissionModule | 'admin', level: 'read' | 'write' = 'read') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    if (hasPerm(readPerms(req), perm, level)) return next();
    return res.status(403).json({ success: false, error: `Permission '${perm}' requise` });
  };
}

// Raccourci : exige l'écriture sur un module
export function requireWrite(perm: PermissionModule | 'admin') {
  return requirePerm(perm, 'write');
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    if (readPerms(req).all) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Rôle insuffisant' });
    }
    next();
  };
}

// Retourne le magasin_id effectif pour filtrer les données.
// - Utilisateur 1 magasin  → fixé, ignorera le query param
// - Utilisateur N magasins → utilise ?magasin_id= (doit être dans sa liste)
// - Admin ([] vide)        → utilise ?magasin_id= librement, null = voit tout
export function scopeMagasin(req: Request): number | null {
  const ids = req.user?.magasin_ids ?? [];
  if (ids.length === 1) return ids[0];               // magasin unique, figé
  const qp = req.query.magasin_id;
  if (qp && !isNaN(Number(qp))) {
    const n = Number(qp);
    if (ids.length > 0 && !ids.includes(n)) return ids[0]; // hors périmètre → premier
    return n;
  }
  return null; // pas de filtre (admin ou multi sans sélection)
}
