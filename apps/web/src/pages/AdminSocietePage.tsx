import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Skeleton, toast } from '../components/ui';
import { useSociete, useSocieteUpdate } from '../hooks/useSociete';
import { SocieteParametres } from '@storebox/shared';

// ── Composants UI internes ────────────────────────────────────────

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[#6B6862]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#A8A49E] mt-0.5">{hint}</p>}
    </div>
  );
}

function Section({
  title, icon, children, cols = 1, className = '',
}: { title: string; icon: React.ReactNode; children: React.ReactNode; cols?: 1 | 2; className?: string }) {
  return (
    <div className={`card p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-2.5 pb-3 border-b border-black/[0.06]">
        <div className="w-7 h-7 rounded-lg bg-[#F2F0EB] flex items-center justify-center text-[#6B6862] flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-[12px] font-semibold text-[#1A1917] uppercase tracking-wide">{title}</h3>
      </div>
      <div className={cols === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>
        {children}
      </div>
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 p-3 border border-black/[0.07] rounded-xl cursor-pointer hover:bg-[#FAFAF8] transition-colors group">
      <div className="mt-0.5 flex-shrink-0">
        <div
          onClick={() => onChange(!checked)}
          className={`w-9 h-5 rounded-full transition-all duration-200 flex items-center px-0.5 cursor-pointer ${checked ? 'bg-[#1A1917]' : 'bg-black/[0.12]'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-medium text-[#1A1917] leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-[#A8A49E] mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

// ── Icônes des sections ───────────────────────────────────────────

const IcoBuilding = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <path d="M2 11V5l5-3 5 3v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="5" y="7" width="4" height="4" rx=".8" fill="currentColor" opacity=".5"/>
  </svg>
);
const IcoPhone = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <path d="M2 2.5c0-.8.6-1.5 1.4-1.5.4 0 .8.2 1 .5l1.4 2c.3.4.3.9 0 1.3L5 5.6c.6 1.2 1.5 2.2 2.8 2.9l.7-.7c.4-.4 1-.4 1.4-.1l2 1.4c.3.2.5.6.5 1C12.4 11.4 11.7 12 11 12 6.1 12 2 7.9 2 3v-.5z" fill="currentColor" opacity=".7"/>
  </svg>
);
const IcoLocation = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <path d="M7 1a4 4 0 014 4c0 3-4 8-4 8S3 8 3 5a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="7" cy="5" r="1.5" fill="currentColor" opacity=".7"/>
  </svg>
);
const IcoDoc = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M5 4.5h4M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IcoCoin = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M7 4v6M5.5 5.5h3a1 1 0 010 2h-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IcoBank = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <path d="M1 5l6-3 6 3M1 5h12M2 5v6M12 5v6M5 8v3M9 8v3M1 11h12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoPalette = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="5" cy="5.5" r="1" fill="currentColor"/>
    <circle cx="9" cy="5.5" r="1" fill="currentColor"/>
    <circle cx="7" cy="9" r="1" fill="currentColor"/>
  </svg>
);
const IcoGear = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IcoImage = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
    <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="5" cy="5.5" r="1.2" fill="currentColor" opacity=".7"/>
    <path d="M1 10l3-3 3 2.5L10 6l3 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Skeleton de chargement ────────────────────────────────────────

function SocieteSkeleton() {
  return (
    <>
      <PageHeader title="Paramètres de la société" subtitle="Chargement…" />
      <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto space-y-4 animate-fade-in">
        <div className="flex gap-1 bg-[#F2F0EB] rounded-xl p-1 w-fit">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[0,1].map(i => (
            <div key={i} className="card p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-black/[0.06]">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-3 w-32" />
              </div>
              {[0,1,2].map(j => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── ColorPicker inline ────────────────────────────────────────────

function ColorField({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-lg border border-black/[0.14] cursor-pointer shadow-sm overflow-hidden"
            style={{ background: value || '#000000' }}
          />
          <input
            type="color"
            value={value || '#000000'}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="input font-mono text-[13px] flex-1"
          maxLength={7}
        />
      </div>
    </Field>
  );
}

// ── Page principale ───────────────────────────────────────────────

const TABS = [
  { k: 'identite',      label: 'Identité',      icon: '🏢' },
  { k: 'contact',       label: 'Contact',        icon: '📞' },
  { k: 'finance',       label: 'Finance',        icon: '💰' },
  { k: 'notifications', label: 'Notifications',  icon: '📱' },
  { k: 'apparence',     label: 'Apparence',      icon: '🎨' },
] as const;

type TabKey = typeof TABS[number]['k'];

export default function AdminSocietePage() {
  const { data: societe, loading } = useSociete();
  const { update, loading: saving, error: saveError } = useSocieteUpdate();

  const [form, setForm]   = useState<Partial<SocieteParametres>>({});
  const [tab, setTab]     = useState<TabKey>('identite');
  const [dirty, setDirty] = useState(false);
  const logoInputRef      = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Image trop lourde (max 2 Mo)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setVal('logo_url', ev.target?.result as string);
      toast('Logo chargé — pensez à enregistrer', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (societe) { setForm(societe); setDirty(false); }
  }, [societe]);

  const set = useCallback((field: keyof SocieteParametres) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setDirty(true);
  }, []);

  const setVal = useCallback((field: keyof SocieteParametres, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    const result = await update(form);
    if (result) {
      setForm(result);
      setDirty(false);
      toast('Paramètres enregistrés avec succès', 'success');
    } else {
      toast(saveError || 'Erreur lors de la sauvegarde', 'error');
    }
  };

  if (loading) return <SocieteSkeleton />;

  return (
    <>
      <PageHeader
        title="Paramètres de la société"
        subtitle={form.nom ? `${form.nom} · ${form.ville ?? 'Non défini'}` : 'Configuration de votre entreprise'}
        action={
          dirty && (
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving
                ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2" opacity=".3"/><path d="M7 2a5 5 0 015 5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg> Enregistrement…</>
                : <><svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5"><path d="M2 7l4 4 6-7" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> Enregistrer</>
              }
            </button>
          )
        }
      />

      <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto space-y-5 animate-fade-in">

        {/* Bandeau preview de la société */}
        <div className="card p-4 flex items-center gap-4">
          {/* Logo ou initiales */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-black/[0.07]"
            style={{ background: form.couleur_primaire ? `${form.couleur_primaire}18` : '#F2F0EB' }}
          >
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: form.couleur_primaire || '#A8A49E' }}>
                {(form.nom ?? 'S')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[#1A1917] truncate">{form.nom || 'Nom de la société'}</div>
            {form.raison_sociale && <div className="text-xs text-[#6B6862]">{form.raison_sociale}</div>}
            {form.slogan && <div className="text-[11px] text-[#A8A49E] italic mt-0.5">{form.slogan}</div>}
          </div>
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
            {form.telephone && (
              <div className="text-[11px] text-[#6B6862] flex items-center gap-1">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M1 1.8c0-.5.4-1 1-1h.7l1 2-.6.7c.4.9 1.1 1.6 2 2.1l.7-.5 2 1v.7c0 .6-.5 1-1 1A8 8 0 011 1.8z" fill="currentColor" opacity=".6"/></svg>
                {form.telephone}
              </div>
            )}
            {form.ville && (
              <div className="text-[11px] text-[#6B6862] flex items-center gap-1">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M6 1a3 3 0 013 3c0 2.5-3 6-3 6S3 6.5 3 4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1"/></svg>
                {form.ville}, {form.pays}
              </div>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-[#F2F0EB] rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map(({ k, label, icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] rounded-lg font-medium transition-all duration-150 whitespace-nowrap ${
                tab === k
                  ? 'bg-white text-[#1A1917] shadow-sm'
                  : 'text-[#6B6862] hover:text-[#1A1917]'
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ══════════ ONGLET IDENTITÉ ══════════════════════════════════ */}
        {tab === 'identite' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <Section title="Informations générales" icon={<IcoBuilding />} cols={1}>
                <Field label="Nom de la société" required>
                  <input className="input" value={form.nom ?? ''} onChange={set('nom')} placeholder="ex : StoreBox CI" />
                </Field>
                <Field label="Raison sociale" hint="Forme juridique complète (SARL, SAS, etc.)">
                  <input className="input" value={form.raison_sociale ?? ''} onChange={set('raison_sociale')} placeholder="ex : StoreBox SARL" />
                </Field>
                <Field label="Slogan" hint="Accroche affichée sur vos documents">
                  <input className="input" value={form.slogan ?? ''} onChange={set('slogan')} placeholder="ex : La gestion simplifiée" />
                </Field>
                <Field label="Description">
                  <textarea className="input resize-none" rows={5} value={form.description ?? ''} onChange={set('description')} placeholder="Négoce de téléphones et accessoires…" />
                </Field>
              </Section>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">
              <Section title="Données légales & Signatures" icon={<IcoDoc />} cols={1}>
                <Field label="RCCM" hint="Registre du Commerce et du Crédit Mobilier">
                  <input className="input font-mono" value={form.rccm ?? ''} onChange={set('rccm')} placeholder="ex : CI-ABJ-2024-B-00123" />
                </Field>
                <Field label="Numéro d'impôt (NIF)" hint="Numéro d'Identification Fiscale">
                  <input className="input font-mono" value={form.numero_impot ?? ''} onChange={set('numero_impot')} placeholder="ex : 0012345678" />
                </Field>
                <div className="border-t border-black/[0.06] pt-4 space-y-4">
                  <Field label="Nom du dirigeant" hint="Apparaît sur les documents officiels">
                    <input className="input" value={form.signature_dirigeant ?? ''} onChange={set('signature_dirigeant')} placeholder="ex : Jean-Marc KOUASSI, DG" />
                  </Field>
                  <Field label="Nom du comptable" hint="Visas et états financiers">
                    <input className="input" value={form.signature_comptable ?? ''} onChange={set('signature_comptable')} placeholder="ex : Marie DIALLO, DAF" />
                  </Field>
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET CONTACT ═══════════════════════════════════ */}
        {tab === 'contact' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <Section title="Coordonnées téléphoniques" icon={<IcoPhone />} cols={1}>
                <Field label="Téléphone principal">
                  <input className="input" type="tel" value={form.telephone ?? ''} onChange={set('telephone')} placeholder="+225 27 22 XX XX XX" />
                </Field>
                <Field label="Téléphone secondaire / WhatsApp">
                  <input className="input" type="tel" value={form.telephone2 ?? ''} onChange={set('telephone2')} placeholder="+225 07 XX XX XX XX" />
                </Field>
                <Field label="Email général">
                  <input className="input" type="email" value={form.email ?? ''} onChange={set('email')} placeholder="contact@societe.ci" />
                </Field>
                <Field label="Email facturation" hint="Reçoit les copies de factures et bons de commande">
                  <input className="input" type="email" value={form.email_facturation ?? ''} onChange={set('email_facturation')} placeholder="factures@societe.ci" />
                </Field>
              </Section>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">
              <Section title="Adresse du siège social" icon={<IcoLocation />} cols={1}>
                <Field label="Adresse ligne 1">
                  <input className="input" value={form.adresse ?? ''} onChange={set('adresse')} placeholder="ex : 12 rue du Commerce" />
                </Field>
                <Field label="Adresse ligne 2" hint="Quartier, zone industrielle, immeuble…">
                  <input className="input" value={form.adresse2 ?? ''} onChange={set('adresse2')} placeholder="ex : Zone 4, Immeuble Alpha" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ville">
                    <input className="input" value={form.ville ?? ''} onChange={set('ville')} placeholder="Abidjan" />
                  </Field>
                  <Field label="Code postal">
                    <input className="input font-mono" value={form.code_postal ?? ''} onChange={set('code_postal')} placeholder="01 BP …" />
                  </Field>
                </div>
                <Field label="Pays">
                  <select className="input" value={form.pays ?? ''} onChange={set('pays')}>
                    <option value="">— Choisir —</option>
                    <option value="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
                    <option value="Sénégal">🇸🇳 Sénégal</option>
                    <option value="Mali">🇲🇱 Mali</option>
                    <option value="Burkina Faso">🇧🇫 Burkina Faso</option>
                    <option value="Ghana">🇬🇭 Ghana</option>
                    <option value="Cameroun">🇨🇲 Cameroun</option>
                    <option value="Guinée">🇬🇳 Guinée</option>
                    <option value="Togo">🇹🇬 Togo</option>
                    <option value="Bénin">🇧🇯 Bénin</option>
                    <option value="Niger">🇳🇪 Niger</option>
                    <option value="France">🇫🇷 France</option>
                    <option value="Autre">Autre</option>
                  </select>
                </Field>
              </Section>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET FINANCE ═══════════════════════════════════ */}
        {tab === 'finance' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <Section title="Paramètres commerciaux" icon={<IcoCoin />} cols={1}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Devise" required hint="FCFA, USD, EUR…">
                    <input className="input font-mono" value={form.devise ?? 'XOF'} onChange={set('devise')} placeholder="XOF" maxLength={10} />
                  </Field>
                  <Field label="TVA par défaut (%)" hint="18% en Côte d'Ivoire">
                    <div className="relative">
                      <input className="input font-mono pr-8" type="number" value={form.tva_defaut ?? 18} onChange={set('tva_defaut')} min={0} max={100} step={0.5} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A49E] text-sm pointer-events-none">%</span>
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Langue">
                    <select className="input" value={form.langue ?? 'fr'} onChange={set('langue')}>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </Field>
                  <Field label="Format de date">
                    <select className="input font-mono" value={form.format_date ?? 'DD/MM/YYYY'} onChange={set('format_date')}>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </Field>
                </div>

                {/* Aperçu des paramètres */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Devise', val: form.devise || 'XOF' },
                    { label: 'TVA',    val: `${form.tva_defaut ?? 18}%` },
                    { label: 'Format', val: form.format_date || 'DD/MM/YYYY' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-[#F8F7F4] rounded-lg p-2.5 text-center border border-black/[0.06]">
                      <div className="font-mono text-[10px] text-[#A8A49E] uppercase mb-1">{label}</div>
                      <div className="text-[13px] font-semibold text-[#1A1917]">{val}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">
              <Section title="Coordonnées bancaires" icon={<IcoBank />} cols={1}>
                <Field label="Numéro de compte bancaire">
                  <input className="input font-mono" value={form.numero_compte_bancaire ?? ''} onChange={set('numero_compte_bancaire')} placeholder="CI XX XXXX XXXX XXXX" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IBAN">
                    <input className="input font-mono text-[12px]" value={form.iban ?? ''} onChange={set('iban')} placeholder="CI XX XXXX…" />
                  </Field>
                  <Field label="SWIFT / BIC">
                    <input className="input font-mono" value={form.swift ?? ''} onChange={set('swift')} placeholder="BICICIAB" />
                  </Field>
                </div>
                <Field label="Nom de la banque">
                  <input className="input" value={form.nom_banque ?? ''} onChange={set('nom_banque')} placeholder="ex : Société Générale CI" />
                </Field>
                <Field label="Adresse de la banque">
                  <input className="input" value={form.adresse_banque ?? ''} onChange={set('adresse_banque')} placeholder="ex : Avenue Houphouët-Boigny, Abidjan" />
                </Field>
                <Field label="Téléphone de la banque">
                  <input className="input" type="tel" value={form.telephone_banque ?? ''} onChange={set('telephone_banque')} placeholder="+225 XX XX XX XX XX" />
                </Field>
              </Section>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET NOTIFICATIONS ═════════════════════════════ */}
        {tab === 'notifications' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Section title="Activation & fournisseurs" icon={<IcoPhone />} cols={1}>
                <Toggle
                  label="Activer les SMS"
                  hint="Confirmations de vente, relances créances, alertes internes"
                  checked={form.sms_actif ?? true}
                  onChange={v => setVal('sms_actif', v)}
                />
                <Toggle
                  label="Activer WhatsApp"
                  hint="Confirmations (grossistes) et relances par WhatsApp"
                  checked={form.wa_actif ?? true}
                  onChange={v => setVal('wa_actif', v)}
                />
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field label="Fournisseur SMS">
                    <select className="input" value={form.sms_provider ?? 'twilio'} onChange={set('sms_provider')}>
                      <option value="twilio">Twilio</option>
                      <option value="orange_ci">Orange CI</option>
                      <option value="infobip">Infobip</option>
                    </select>
                  </Field>
                  <Field label="Fournisseur WhatsApp">
                    <select className="input" value={form.wa_provider ?? 'twilio'} onChange={set('wa_provider')}>
                      <option value="twilio">Twilio</option>
                      <option value="infobip">Infobip</option>
                    </select>
                  </Field>
                </div>
                <Field label="Téléphone du gérant" hint="Destinataire des alertes internes (stock, péremption)">
                  <input className="input" value={form.gerant_tel ?? ''} onChange={set('gerant_tel')} placeholder="+225 07 00 00 00 00" />
                </Field>
              </Section>

              <Section title="Twilio" icon={<IcoGear />} cols={1}>
                <Field label="Account SID">
                  <input className="input font-mono text-[12px]" value={form.twilio_account_sid ?? ''} onChange={set('twilio_account_sid')} placeholder="ACxxxxxxxx…" />
                </Field>
                <Field label="Auth Token">
                  <input className="input font-mono text-[12px]" type="password" value={form.twilio_auth_token ?? ''} onChange={set('twilio_auth_token')} placeholder="••••••••" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Numéro SMS" hint="From">
                    <input className="input" value={form.twilio_from ?? ''} onChange={set('twilio_from')} placeholder="+1234567890" />
                  </Field>
                  <Field label="Numéro WhatsApp" hint="ex : whatsapp:+14155238886">
                    <input className="input text-[12px]" value={form.twilio_wa_from ?? ''} onChange={set('twilio_wa_from')} placeholder="whatsapp:+1415…" />
                  </Field>
                </div>
              </Section>
            </div>

            <div className="space-y-4">
              <Section title="Orange CI" icon={<IcoGear />} cols={1}>
                <Field label="Clé API">
                  <input className="input font-mono text-[12px]" type="password" value={form.orange_sms_api_key ?? ''} onChange={set('orange_sms_api_key')} placeholder="••••••••" />
                </Field>
                <Field label="Expéditeur (sender)">
                  <input className="input" value={form.orange_sender ?? ''} onChange={set('orange_sender')} placeholder="StoreBox" />
                </Field>
              </Section>

              <Section title="Infobip" icon={<IcoGear />} cols={1}>
                <Field label="Clé API">
                  <input className="input font-mono text-[12px]" type="password" value={form.infobip_api_key ?? ''} onChange={set('infobip_api_key')} placeholder="••••••••" />
                </Field>
                <Field label="Base URL">
                  <input className="input text-[12px]" type="url" value={form.infobip_base_url ?? ''} onChange={set('infobip_base_url')} placeholder="https://xxxxx.api.infobip.com" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expéditeur SMS">
                    <input className="input" value={form.infobip_from ?? ''} onChange={set('infobip_from')} placeholder="StoreBox" />
                  </Field>
                  <Field label="Expéditeur WhatsApp">
                    <input className="input" value={form.infobip_wa_from ?? ''} onChange={set('infobip_wa_from')} placeholder="447xxxx…" />
                  </Field>
                </div>
              </Section>

              <div className="card p-4 bg-[#FBFAF8] border-amber-200/60">
                <p className="text-[11px] text-[#6B6862] leading-relaxed">
                  🔒 Les identifiants sont stockés en base et utilisés côté serveur.
                  Laisser un champ vide conserve la valeur des variables d'environnement.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET APPARENCE ═════════════════════════════════ */}
        {tab === 'apparence' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <Section title="Logo de la société" icon={<IcoImage />} cols={1}>
                {/* Aperçu + upload */}
                <div className="flex items-start gap-4">
                  {/* Vignette */}
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-black/[0.12] flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-brand-400 transition-colors"
                    style={{ background: form.couleur_primaire ? `${form.couleur_primaire}12` : '#F8F7F4' }}
                    onClick={() => logoInputRef.current?.click()}
                    title="Cliquer pour changer le logo"
                  >
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo aperçu" className="w-full h-full object-contain p-2"
                           onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#C4C0BA]">
                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Input caché */}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />

                  <div className="flex-1 space-y-2">
                    <Field label="URL du logo" hint="PNG, JPG ou SVG · recommandé 256×256 px">
                      <input className="input text-[12px]" type="url" value={form.logo_url ?? ''} onChange={set('logo_url')} placeholder="https://…/logo.png" />
                    </Field>
                    {/* Boutons action */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-[12px] font-medium bg-[#F2F0EB] hover:bg-[#E8E5DF] text-[#1A1917] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                          <path d="M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        Charger un fichier
                      </button>
                      {form.logo_url && (
                        <button type="button" onClick={() => setVal('logo_url', '')}
                          className="text-[12px] text-red-500 hover:text-red-600 font-medium transition-colors">
                          Supprimer
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#A8A49E]">PNG, JPG, SVG, WEBP · max 2 Mo</p>
                  </div>
                </div>
              </Section>

              <Section title="Palette de couleurs" icon={<IcoPalette />} cols={1}>
                <ColorField
                  label="Couleur primaire"
                  hint="En-têtes de documents, boutons, accents"
                  value={form.couleur_primaire ?? '#1B5FD6'}
                  onChange={v => setVal('couleur_primaire', v)}
                />
                <ColorField
                  label="Couleur secondaire"
                  hint="Éléments secondaires, fonds, accents doux"
                  value={form.couleur_secondaire ?? '#1A7A4A'}
                  onChange={v => setVal('couleur_secondaire', v)}
                />
                {/* Aperçu des couleurs */}
                <div className="flex gap-2 pt-1">
                  <div className="flex-1 rounded-lg h-10 flex items-center justify-center text-white text-[11px] font-medium"
                       style={{ background: form.couleur_primaire || '#1B5FD6' }}>
                    Primaire
                  </div>
                  <div className="flex-1 rounded-lg h-10 flex items-center justify-center text-white text-[11px] font-medium"
                       style={{ background: form.couleur_secondaire || '#1A7A4A' }}>
                    Secondaire
                  </div>
                </div>
              </Section>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">

              <Section title="Informations système" icon={<IcoGear />} cols={1}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Version',     val: 'StoreBox v2.0' },
                    { label: 'Environnement', val: 'Production' },
                    { label: 'Mise à jour', val: form.updated_at ? new Date(form.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Base de données', val: 'PostgreSQL 16' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-[#F8F7F4] rounded-xl p-3 border border-black/[0.06]">
                      <div className="font-mono text-[10px] text-[#A8A49E] uppercase tracking-wide mb-1">{label}</div>
                      <div className="text-[12px] font-semibold text-[#1A1917]">{val}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ── Barre de sauvegarde flottante ─────────────────────────── */}
        {dirty && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="flex items-center gap-3 bg-[#1A1917] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10">
              <div className="flex items-center gap-1.5 text-[12px] text-white/70">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Modifications non enregistrées
              </div>
              <div className="w-px h-4 bg-white/20" />
              <button
                onClick={() => { setForm(societe ?? {}); setDirty(false); }}
                className="text-[12px] text-white/60 hover:text-white transition-colors"
                disabled={saving}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-medium bg-white text-[#1A1917] px-3 py-1.5 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-60"
              >
                {saving
                  ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" opacity=".3"/><path d="M7 2a5 5 0 015 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Sauvegarde…</>
                  : <>Enregistrer</>
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
