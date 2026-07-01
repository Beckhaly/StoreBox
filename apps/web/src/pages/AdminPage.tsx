import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Spinner, toast } from '../components/ui';
import { Modal, FormRow, FormGrid, FormFooter } from '../components/ui/Modal';
import { PermissionMatrix } from '../components/ui/PermissionMatrix';
import { useApi } from '../hooks/useApi';
import { UtilisateurAdmin, Role, Magasin, Permissions } from '@storebox/shared';
import { fdate } from '../lib/formatters';
import { api } from '../lib/api';

interface AdminData { utilisateurs: UtilisateurAdmin[]; }

// Résumé court des droits d'un rôle (compte lecture/écriture)
function permSummary(p?: Permissions): string {
  if (!p) return '—';
  if (p.all) return 'Accès total';
  const entries = Object.entries(p).filter(([k]) => k !== 'all' && k !== 'admin');
  const nbWrite = entries.filter(([, v]) => v === true).length;
  const nbRead  = entries.filter(([, v]) => v === 'read').length;
  const parts = [];
  if (p.admin) parts.push('Administration');
  if (nbWrite) parts.push(`${nbWrite} en écriture`);
  if (nbRead) parts.push(`${nbRead} en lecture`);
  return parts.length ? parts.join(' · ') : 'Aucun droit';
}

type UserForm = {
  code: string; prenom: string; nom: string; email: string;
  telephone: string; role_id: string; password: string;
  actif: string; magasin_ids: number[];
};

const VIDE: UserForm = {
  code: '', prenom: '', nom: '', email: '', telephone: '',
  role_id: '', password: '', actif: 'true', magasin_ids: [],
};

function UserFormFields({
  f, s, toggleMagasin, isEdit, roles, magasins, override, onOverride,
}: {
  f: UserForm;
  s: (k: string, v: string) => void;
  toggleMagasin: (id: number) => void;
  isEdit?: boolean;
  roles: Role[];
  magasins: Magasin[];
  override: Permissions;
  onOverride: (p: Permissions) => void;
}) {
  const [showOverride, setShowOverride] = useState(Object.keys(override).length > 0);
  const roleName = roles.find(r => String(r.id) === f.role_id)?.nom;
  return (
    <>
      {!isEdit && (
        <FormRow label="Code" required>
          <input className="input text-sm font-mono" value={f.code} onChange={e => s('code', e.target.value)} required placeholder="USR-007" />
        </FormRow>
      )}
      <FormGrid>
        <FormRow label="Prénom" required>
          <input className="input text-sm" value={f.prenom} onChange={e => s('prenom', e.target.value)} required />
        </FormRow>
        <FormRow label="Nom" required>
          <input className="input text-sm" value={f.nom} onChange={e => s('nom', e.target.value)} required />
        </FormRow>
      </FormGrid>
      <FormGrid>
        <FormRow label="Email" required>
          <input className="input text-sm" type="email" value={f.email} onChange={e => s('email', e.target.value)} required />
        </FormRow>
        <FormRow label="Téléphone">
          <input className="input text-sm" value={f.telephone} onChange={e => s('telephone', e.target.value)} />
        </FormRow>
      </FormGrid>
      <FormRow label="Rôle" required>
        <select className="input text-sm" value={f.role_id} onChange={e => s('role_id', e.target.value)} required>
          <option value="">— Sélectionner —</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
        </select>
      </FormRow>
      <FormRow label="Magasins autorisés">
        <div className="space-y-1.5 pt-0.5">
          {magasins.map(mg => (
            <label key={mg.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={f.magasin_ids.includes(mg.id)}
                onChange={() => toggleMagasin(mg.id)}
                className="rounded border-[#D6D1CA] text-[#1a1a1a] focus:ring-0"
              />
              <span className="text-sm text-[#1A1917]">{mg.nom}</span>
              <span className="font-mono text-[10px] text-[#A8A49E]">{mg.code}</span>
            </label>
          ))}
          {magasins.length === 0 && <span className="text-xs text-[#A8A49E]">Aucun magasin disponible</span>}
          <p className="text-[10px] text-[#A8A49E] pt-0.5">Aucune case cochée = accès administrateur à tous les magasins</p>
        </div>
      </FormRow>
      <FormRow label="Statut">
        <select className="input text-sm" value={f.actif} onChange={e => s('actif', e.target.value)}>
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </select>
      </FormRow>
      <FormRow label={isEdit ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'} required={!isEdit}>
        <input className="input text-sm" type="password" value={f.password} onChange={e => s('password', e.target.value)}
          required={!isEdit} placeholder={isEdit ? '••••••••' : ''} />
      </FormRow>

      {/* Surcharge de droits individuelle (optionnelle) */}
      <div className="pt-2 border-t border-[#E7E4DE]">
        <button type="button" onClick={() => setShowOverride(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#6B6862] hover:text-[#1A1917]">
          <span>{showOverride ? '▾' : '▸'}</span>
          Droits personnalisés {Object.keys(override).length > 0 && <span className="text-blue-600">(actifs)</span>}
        </button>
        {showOverride && (
          <div className="mt-2 p-3 rounded-xl bg-[#FafaF8] border border-[#E7E4DE]">
            <p className="text-[11px] text-[#A8A49E] mb-3">
              Surcharge les droits du rôle {roleName ? `« ${roleName} »` : ''} pour cet utilisateur uniquement.
              Laissez vide pour utiliser les droits du rôle.
            </p>
            <PermissionMatrix value={override} onChange={onOverride} />
            {Object.keys(override).length > 0 && (
              <button type="button" onClick={() => onOverride({})}
                className="mt-2 text-[11px] text-red-600 hover:text-red-700">Réinitialiser (utiliser le rôle)</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminPage() {
  const { data, loading, refresh }               = useApi<AdminData>('/admin/utilisateurs');
  const { data: rolesData, refresh: refreshRoles } = useApi<Role[]>('/admin/roles');
  const { data: magasinsData }                   = useApi<Magasin[]>('/magasins');

  const [tab,        setTab]        = useState<'users' | 'roles'>('users');
  const [open,       setOpen]       = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ ...VIDE });
  const [createOverride, setCreateOverride] = useState<Permissions>({});
  const [editUser,   setEditUser]   = useState<UtilisateurAdmin | null>(null);
  const [editForm,   setEditForm]   = useState({ ...VIDE });
  const [editOverride, setEditOverride] = useState<Permissions>({});
  const [editSaving, setEditSaving] = useState(false);

  const roles    = rolesData    ?? [];
  const magasins = magasinsData ?? [];
  const utilisateurs = data?.utilisateurs ?? [];

  const set     = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const toggleMagasin = (id: number) =>
    setForm(f => ({
      ...f,
      magasin_ids: f.magasin_ids.includes(id) ? f.magasin_ids.filter(x => x !== id) : [...f.magasin_ids, id],
    }));

  const toggleEditMagasin = (id: number) =>
    setEditForm(f => ({
      ...f,
      magasin_ids: f.magasin_ids.includes(id) ? f.magasin_ids.filter(x => x !== id) : [...f.magasin_ids, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/admin/utilisateurs', {
      ...form, role_id: Number(form.role_id), actif: form.actif === 'true',
      permissions_override: createOverride,
    });
    setSaving(false);
    if (res.success) {
      toast('Utilisateur créé', 'success');
      setOpen(false); setForm({ ...VIDE }); setCreateOverride({}); refresh();
    } else {
      toast(res.error ?? 'Erreur lors de la création', 'error');
    }
  };

  const openEdit = (u: UtilisateurAdmin) => {
    setEditUser(u);
    setEditOverride((u.permissions_override ?? {}) as Permissions);
    setEditForm({
      code: u.code, prenom: u.prenom, nom: u.nom, email: u.email,
      telephone: u.telephone ?? '', role_id: String(u.role_id), password: '',
      actif: u.actif ? 'true' : 'false', magasin_ids: u.magasin_ids ?? [],
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    const payload: Record<string, unknown> = {
      prenom: editForm.prenom, nom: editForm.nom, email: editForm.email,
      telephone: editForm.telephone || null,
      role_id: Number(editForm.role_id),
      magasin_ids: editForm.magasin_ids,
      actif: editForm.actif === 'true',
    };
    if (editForm.password) payload.password = editForm.password;
    payload.permissions_override = editOverride;
    const res = await api.put(`/admin/utilisateurs/${editUser.id}`, payload);
    setEditSaving(false);
    if (res.success) {
      toast('Utilisateur modifié', 'success'); setEditUser(null); refresh();
    } else {
      toast(res.error ?? 'Erreur modification', 'error');
    }
  };

  const handleDelete = async (u: UtilisateurAdmin) => {
    if (!confirm(`Désactiver l'utilisateur ${u.prenom} ${u.nom} ?`)) return;
    const res = await api.delete(`/admin/utilisateurs/${u.id}`);
    if (res.success) { toast('Utilisateur désactivé', 'success'); refresh(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  // ─── Rôles & droits ───────────────────────────────────────────
  const [roleEdit, setRoleEdit] = useState<Role | 'new' | null>(null);
  const [roleForm, setRoleForm] = useState<{ code: string; libelle: string; permissions: Permissions }>({ code: '', libelle: '', permissions: {} });
  const [roleSaving, setRoleSaving] = useState(false);

  const openRole = (r: Role | 'new') => {
    setRoleEdit(r);
    if (r === 'new') setRoleForm({ code: '', libelle: '', permissions: {} });
    else setRoleForm({ code: r.code, libelle: r.libelle ?? r.nom, permissions: (r.permissions ?? {}) as Permissions });
  };

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleSaving(true);
    const res = roleEdit === 'new'
      ? await api.post('/admin/roles', { code: roleForm.code, libelle: roleForm.libelle, permissions: roleForm.permissions })
      : await api.put(`/admin/roles/${(roleEdit as Role).id}`, { libelle: roleForm.libelle, permissions: roleForm.permissions });
    setRoleSaving(false);
    if (res.success) {
      toast(roleEdit === 'new' ? 'Rôle créé' : 'Rôle mis à jour', 'success');
      setRoleEdit(null); refreshRoles();
    } else toast(res.error ?? 'Erreur', 'error');
  };

  const deleteRole = async (r: Role) => {
    if (!confirm(`Supprimer le rôle « ${r.nom} » ?`)) return;
    const res = await api.delete(`/admin/roles/${r.id}`);
    if (res.success) { toast('Rôle supprimé', 'success'); refreshRoles(); }
    else toast(res.error ?? 'Erreur', 'error');
  };

  return (
    <>
      <PageHeader
        title="Utilisateurs & droits"
        subtitle="Comptes, rôles et permissions"
        action={tab === 'users'
          ? <button className="btn btn-primary text-xs" onClick={() => { setForm({ ...VIDE }); setCreateOverride({}); setOpen(true); }}>+ Nouvel utilisateur</button>
          : <button className="btn btn-primary text-xs" onClick={() => openRole('new')}>+ Nouveau rôle</button>}
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Onglets */}
        <div className="flex gap-1 border-b border-black/[0.08]">
          {([['users','Utilisateurs'],['roles','Rôles & droits']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                tab === k ? 'border-[#1A1917] text-[#1A1917]' : 'border-transparent text-[#A8A49E] hover:text-[#6B6862]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    {['Utilisateur','Email','Rôle','Magasins','Dernière connexion','Statut','Actions'].map(h => (
                      <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map(u => (
                    <tr key={u.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{u.prenom} {u.nom}</div>
                        <div className="font-mono text-[10px] text-[#A8A49E]">{u.code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862]">{u.email}</td>
                      <td className="px-4 py-2.5"><Badge statut={u.role} /></td>
                      <td className="px-4 py-2.5 text-[#6B6862] text-[11px]">
                        {u.magasin_ids?.length
                          ? (u.magasin_noms ?? u.magasin_ids.map(String)).join(', ')
                          : <span className="text-[#A8A49E]">Tous</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#6B6862]">{fdate(u.derniere_cnx)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-[10px] ${u.actif ? 'text-green-700' : 'text-[#A8A49E]'}`}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)}
                            className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                            Modifier
                          </button>
                          {u.actif && (
                            <button onClick={() => handleDelete(u)}
                              className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                              Désactiver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {utilisateurs.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-[#A8A49E] py-10">Aucun utilisateur</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {tab === 'roles' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  {['Rôle','Type','Utilisateurs','Droits','Actions'].map(h => (
                    <th key={h} className="text-left font-mono text-[10px] text-[#A8A49E] px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id} className="border-b border-black/[0.04] hover:bg-[#F8F7F4]">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.libelle ?? r.nom}</div>
                      <div className="font-mono text-[10px] text-[#A8A49E]">{r.code}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${r.systeme ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                        {r.systeme ? 'Système' : 'Personnalisé'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#6B6862]">{r.nb_users ?? 0}</td>
                    <td className="px-4 py-2.5 text-[11px] text-[#6B6862]">{permSummary(r.permissions)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openRole(r)}
                          className="btn text-[10px] px-2 py-1 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                          Droits
                        </button>
                        {!r.systeme && (
                          <button onClick={() => deleteRole(r)}
                            className="btn text-[10px] px-2 py-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-[#A8A49E] py-10">Aucun rôle</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel utilisateur" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <UserFormFields f={form} s={set} toggleMagasin={toggleMagasin} roles={roles} magasins={magasins} override={createOverride} onOverride={setCreateOverride} />
          <FormFooter onCancel={() => setOpen(false)} loading={saving} submitLabel="Créer l'utilisateur" />
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Modifier l'utilisateur" size="md">
        {editUser && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <UserFormFields f={editForm} s={setEdit} toggleMagasin={toggleEditMagasin} isEdit roles={roles} magasins={magasins} override={editOverride} onOverride={setEditOverride} />
            <FormFooter onCancel={() => setEditUser(null)} loading={editSaving} submitLabel="Enregistrer les modifications" />
          </form>
        )}
      </Modal>

      {/* Modale rôle : libellé + matrice de droits */}
      <Modal open={!!roleEdit} onClose={() => setRoleEdit(null)}
        title={roleEdit === 'new' ? 'Nouveau rôle' : `Droits — ${roleForm.libelle}`} size="md">
        {roleEdit && (
          <form onSubmit={saveRole} className="space-y-4">
            {roleEdit === 'new' && (
              <FormGrid>
                <FormRow label="Code" required>
                  <input className="input text-sm font-mono" value={roleForm.code}
                    onChange={e => setRoleForm(f => ({ ...f, code: e.target.value }))} required placeholder="responsable" />
                </FormRow>
                <FormRow label="Libellé" required>
                  <input className="input text-sm" value={roleForm.libelle}
                    onChange={e => setRoleForm(f => ({ ...f, libelle: e.target.value }))} required placeholder="Responsable" />
                </FormRow>
              </FormGrid>
            )}
            {roleEdit !== 'new' && (
              <FormRow label="Libellé" required>
                <input className="input text-sm" value={roleForm.libelle}
                  onChange={e => setRoleForm(f => ({ ...f, libelle: e.target.value }))} required />
              </FormRow>
            )}
            <PermissionMatrix value={roleForm.permissions} onChange={p => setRoleForm(f => ({ ...f, permissions: p }))} />
            <FormFooter onCancel={() => setRoleEdit(null)} loading={roleSaving} submitLabel="Enregistrer les droits" />
          </form>
        )}
      </Modal>
    </>
  );
}
