import { useEffect, useRef, ReactNode } from 'react';

interface ModalProps {
  open:     boolean;
  onClose:  () => void;
  title:    string;
  children: ReactNode;
  size?:    'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    // Bloquer le scroll du body
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  // Sur mobile : plein écran (slides depuis le bas)
  // Sur desktop : centré avec largeur max
  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — plein écran mobile, popup desktop */}
      <div className={`
        relative w-full ${maxW[size]}
        bg-white
        rounded-t-2xl sm:rounded-2xl
        shadow-2xl
        flex flex-col
        max-h-[95vh] sm:max-h-[90vh]
        animate-slide-up sm:animate-none
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-black/[0.08] shrink-0">
          <span className="text-[15px] font-semibold text-[#1A1917]">{title}</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B6862] hover:bg-[#F2F0EB] transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// Ligne de formulaire standardisée
export function FormRow({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-mono text-[#6B6862] uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Grille responsive : 1 col mobile → 2 col tablet+
export function FormGrid({ children, cols3 }: { children: ReactNode; cols3?: boolean }) {
  return (
    <div className={`grid grid-cols-1 ${cols3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 sm:gap-4`}>
      {children}
    </div>
  );
}

// Pied de formulaire avec boutons
export function FormFooter({ onCancel, loading, submitLabel = 'Enregistrer' }: {
  onCancel: () => void; loading?: boolean; submitLabel?: string;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 mt-2 border-t border-black/[0.06]">
      <button type="button" onClick={onCancel} className="btn text-xs w-full sm:w-auto justify-center">Annuler</button>
      <button type="submit" disabled={loading}
        className="btn btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-w-[110px] justify-center">
        {loading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : submitLabel}
      </button>
    </div>
  );
}
