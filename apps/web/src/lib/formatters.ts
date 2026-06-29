export const fcfa = (n: number | null | undefined): string => {
  if (n == null) return '—';
  const num = Math.round(n);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
};

export const fcfaM = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return (Math.round(n) / 1_000_000).toFixed(1) + ' M F';
};

export const fdate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
};

export const fdateLong = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

// Couleurs de badge selon statut
type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';

export const STATUT_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  paye:         { variant: 'green',  label: 'Payé' },
  non_paye:     { variant: 'gray',   label: 'Non payé' },
  partiel:      { variant: 'blue',   label: 'Partiel' },
  en_retard:    { variant: 'red',    label: 'En retard' },
  contentieux:  { variant: 'red',    label: 'Contentieux' },
  non_echu:     { variant: 'blue',   label: 'Non échu' },
  echu_30j:     { variant: 'amber',  label: 'Échu ≤30j' },
  echu_60j:     { variant: 'red',    label: 'Échu ≤60j' },
  actif:        { variant: 'green',  label: 'Actif' },
  bloque:       { variant: 'red',    label: 'Bloqué' },
  inactif:      { variant: 'gray',   label: 'Inactif' },
  grossiste:    { variant: 'blue',   label: 'Grossiste' },
  detaillant:   { variant: 'purple', label: 'Détaillant' },
  particulier:  { variant: 'gray',   label: 'Particulier' },
  gros:         { variant: 'blue',   label: 'Gros' },
  detail:       { variant: 'purple', label: 'Détail' },
  // Rôles utilisateurs
  admin:        { variant: 'red',    label: 'Admin' },
  commercial:   { variant: 'blue',   label: 'Commercial' },
  caissier:     { variant: 'green',  label: 'Caissier' },
  comptable:    { variant: 'purple', label: 'Comptable' },
  magasinier:   { variant: 'amber',  label: 'Magasinier' },
};

export const BADGE_CLASSES: Record<BadgeVariant, string> = {
  green:  'bg-green-50  text-green-800',
  red:    'bg-red-50    text-red-800',
  amber:  'bg-amber-50  text-amber-800',
  blue:   'bg-blue-50   text-blue-800',
  purple: 'bg-purple-50 text-purple-800',
  gray:   'bg-gray-100  text-gray-600',
};
