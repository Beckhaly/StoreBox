import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { FormRow } from '../components/ui/Modal';
import { Spinner, toast } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [ancien,  setAncien]  = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);

  const initiales = ((user?.prenom ?? '')[0] ?? '') + ((user?.nom ?? '')[0] ?? '');

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nouveau.length < 8) { toast('Le nouveau mot de passe doit faire au moins 8 caractères', 'warn'); return; }
    if (nouveau !== confirm) { toast('La confirmation ne correspond pas', 'warn'); return; }
    setSaving(true);
    const res = await api.post('/auth/change-password', { ancien, nouveau });
    setSaving(false);
    if (res.success) {
      toast('Mot de passe modifié. Reconnectez-vous.', 'success');
      await logout();
      navigate('/login', { replace: true });
    } else {
      toast(res.error ?? 'Erreur lors du changement', 'error');
    }
  };

  const Info = ({ label, value }: { label: string; value?: string }) => (
    <div>
      <div className="font-mono text-[10px] text-[#A8A49E] uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-sm text-[#1A1917]">{value || '—'}</div>
    </div>
  );

  return (
    <>
      <PageHeader title="Mon profil" subtitle="Informations du compte et sécurité" />

      <div className="p-4 sm:p-6 max-w-2xl space-y-4">
        {/* Identité */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-base font-semibold shadow-sm">
              {initiales.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="text-base font-semibold text-[#1A1917]">{user?.prenom} {user?.nom}</div>
              <div className="font-mono text-xs text-[#A8A49E]">{user?.roleLabel}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Info label="Email"     value={user?.email} />
            <Info label="Téléphone" value={user?.telephone} />
            <Info label="Code"      value={user?.code} />
            <Info label="Magasins"  value={user?.magasin_noms?.length ? user.magasin_noms.join(', ') : 'Tous'} />
          </div>
        </div>

        {/* Changement de mot de passe */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[#1A1917] mb-1">Changer le mot de passe</h3>
          <p className="text-xs text-[#A8A49E] mb-4">Vous serez déconnecté après le changement.</p>
          <form onSubmit={handlePassword} className="space-y-4">
            <FormRow label="Mot de passe actuel" required>
              <input className="input text-sm" type="password" value={ancien} onChange={e => setAncien(e.target.value)} required autoComplete="current-password" />
            </FormRow>
            <FormRow label="Nouveau mot de passe (min. 8 caractères)" required>
              <input className="input text-sm" type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} required minLength={8} autoComplete="new-password" />
            </FormRow>
            <FormRow label="Confirmer le nouveau mot de passe" required>
              <input className="input text-sm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
            </FormRow>
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={saving} className="btn btn-primary text-sm flex items-center gap-2">
                {saving && <Spinner size="sm" />}
                Modifier le mot de passe
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
