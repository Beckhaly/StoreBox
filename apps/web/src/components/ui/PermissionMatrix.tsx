import { PERMISSION_MODULES, Permissions, PermissionModule } from '@storebox/shared';

type Level = 'none' | 'read' | 'write';

function levelOf(v: unknown): Level {
  if (v === true) return 'write';
  if (v === 'read') return 'read';
  return 'none';
}

const LEVELS: { key: Level; label: string; cls: string }[] = [
  { key: 'none',  label: 'Aucun',    cls: 'bg-slate-100 text-slate-500' },
  { key: 'read',  label: 'Lecture',  cls: 'bg-blue-100 text-blue-700' },
  { key: 'write', label: 'Écriture', cls: 'bg-emerald-100 text-emerald-700' },
];

/**
 * Matrice de droits : un sélecteur 3 états (Aucun / Lecture / Écriture) par module.
 * Sert à l'édition des rôles ET aux surcharges individuelles d'un utilisateur.
 */
export function PermissionMatrix({
  value, onChange, disabled = false,
}: {
  value: Permissions;
  onChange: (p: Permissions) => void;
  disabled?: boolean;
}) {
  const all = value.all === true;

  const setModule = (key: PermissionModule, level: Level) => {
    const next: Permissions = { ...value };
    if (level === 'none')      delete (next as Record<string, unknown>)[key];
    else if (level === 'read') (next as Record<string, unknown>)[key] = 'read';
    else                       (next as Record<string, unknown>)[key] = true;
    onChange(next);
  };

  const toggleAll = () => onChange(all ? {} : { all: true });
  const toggleAdmin = () => {
    const next: Permissions = { ...value };
    if (next.admin) delete next.admin; else next.admin = true;
    onChange(next);
  };

  // Regrouper les modules par groupe (ordre du catalogue)
  const groupes = PERMISSION_MODULES.reduce<Record<string, typeof PERMISSION_MODULES>>((acc, m) => {
    (acc[m.groupe] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Super-admin */}
      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-50 border border-violet-200 cursor-pointer">
        <input type="checkbox" checked={all} disabled={disabled} onChange={toggleAll} />
        <span className="text-sm font-medium text-violet-800">Accès total (super-administrateur)</span>
      </label>

      {!all && (
        <>
          <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={value.admin === true} disabled={disabled} onChange={toggleAdmin} />
            <span className="text-sm font-medium text-slate-700">Administration (utilisateurs, rôles, société, magasins)</span>
          </label>

          {Object.entries(groupes).map(([groupe, mods]) => (
            <div key={groupe}>
              <div className="font-mono text-[10px] text-[#A8A49E] uppercase tracking-widest mb-1.5">{groupe}</div>
              <div className="space-y-1">
                {mods.map(m => {
                  const lvl = levelOf((value as Record<string, unknown>)[m.key]);
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-[#1A1917]">{m.label}</span>
                      <div className="flex rounded-lg overflow-hidden border border-black/[0.08]">
                        {LEVELS.map(L => (
                          <button
                            key={L.key}
                            type="button"
                            disabled={disabled}
                            onClick={() => setModule(m.key, L.key)}
                            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              lvl === L.key ? L.cls : 'bg-white text-[#A8A49E] hover:bg-[#F8F7F4]'
                            }`}
                          >
                            {L.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
