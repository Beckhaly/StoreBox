// Helpers de permissions — copie runtime locale à l'API.
// IMPORTANT : ne pas importer de VALEURS depuis @storebox/shared ici.
// Ce package est source-only (main → src/index.ts) et n'est pas compilé en JS,
// donc un require('@storebox/shared') au runtime plante (MODULE_NOT_FOUND).
// On n'importe que des TYPES (effacés au build par tsc).
import type { Permissions, PermissionModule } from '@storebox/shared';

// Fusionne les droits d'un rôle avec les surcharges individuelles d'un utilisateur
export function effectivePerms(role?: Permissions | null, override?: Permissions | null): Permissions {
  if (role?.all) return { all: true };
  return { ...(role ?? {}), ...(override ?? {}) };
}

// Teste si un ensemble de droits autorise un module à un niveau donné
export function hasPerm(
  perms: Permissions | null | undefined,
  mod: PermissionModule | 'admin',
  level: 'read' | 'write' = 'read',
): boolean {
  if (!perms) return false;
  if (perms.all) return true;
  const v = (perms as Record<string, unknown>)[mod];
  if (v === true) return true;            // écriture ⇒ couvre lecture
  if (v === 'read') return level === 'read';
  return false;
}
