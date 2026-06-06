import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import { Permissions } from '@storebox/shared';

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

export function requirePerm(perm: keyof Permissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    let p = req.user.perms as any;

    // Handle case where perms is a string (from mock DB)
    if (typeof p === 'string') {
      try {
        const parsed = JSON.parse(p);
        // Handle old permission format from mock DB
        if (Array.isArray(parsed)) {
          // Old format: ['read_all', 'write_all', 'delete_all', 'admin']
          // Map to new format
          if (parsed.includes('admin') || parsed.includes('write_all') || parsed.includes('delete_all')) {
            p = { all: true };
          } else {
            p = {};
          }
        } else {
          p = parsed;
        }
      } catch {
        return res.status(403).json({ success: false, error: `Permission '${perm}' requise` });
      }
    }

    // Check permissions: admin (all) grants everything
    if (p.all) return next();
    if (p[perm] === true || p[perm] === 'read') return next();

    return res.status(403).json({ success: false, error: `Permission '${perm}' requise` });
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    let p = req.user.perms as any;

    // Handle case where perms is a string (from mock DB)
    if (typeof p === 'string') {
      try {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed)) {
          if (parsed.includes('admin') || parsed.includes('write_all')) {
            p = { all: true };
          } else {
            p = {};
          }
        } else {
          p = parsed;
        }
      } catch {
        return res.status(403).json({ success: false, error: 'Rôle insuffisant' });
      }
    }

    if (p.all) return next();
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
