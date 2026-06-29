import { STATUT_BADGE, BADGE_CLASSES } from '../../lib/formatters';

interface BadgeProps {
  statut: string;
  className?: string;
}

export function Badge({ statut, className = '' }: BadgeProps) {
  const info = STATUT_BADGE[statut];
  if (!info) return <span className={`badge bg-gray-100 text-gray-600 ${className}`}>{statut}</span>;
  return (
    <span className={`badge ${BADGE_CLASSES[info.variant]} ${className}`}>
      {info.label}
    </span>
  );
}
