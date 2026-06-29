// ── Spinner ──────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-4 w-4 border-[1.5px]', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[2.5px]' }[size];
  return (
    <div className={`${s} animate-spin rounded-full border-black/10 border-t-brand-500`} />
  );
}

// ── Skeleton ─────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ── EmptyState ───────────────────────────────────────────────────
export function EmptyState({
  message = 'Aucune donnée',
  icon,
  action,
}: {
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-[#F2F0EB] flex items-center justify-center text-[#A8A49E] mb-1">
          {icon}
        </div>
      )}
      <p className="text-sm text-[#A8A49E]">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── StockBar ─────────────────────────────────────────────────────
export function StockBar({ stock, alerte, max }: { stock: number; alerte: number; max: number }) {
  const pct   = Math.min(100, Math.round((stock / (max || 100)) * 100));
  const color = stock === 0 ? 'bg-red-500' : stock < alerte ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="h-1.5 bg-black/[0.06] rounded-full mt-1">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────
const TOAST_ICONS = {
  success: `<svg viewBox="0 0 14 14" fill="none" width="14" height="14"><circle cx="7" cy="7" r="6" fill="rgba(255,255,255,0.25)"/><path d="M4 7l2.5 2.5L10 5" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg viewBox="0 0 14 14" fill="none" width="14" height="14"><circle cx="7" cy="7" r="6" fill="rgba(255,255,255,0.25)"/><path d="M5 5l4 4M9 5l-4 4" stroke="white" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  warn:    `<svg viewBox="0 0 14 14" fill="none" width="14" height="14"><circle cx="7" cy="7" r="6" fill="rgba(255,255,255,0.25)"/><path d="M7 4.5v3M7 9.5v.5" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>`,
};

let toastContainer: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:9999;
      display:flex;flex-direction:column;gap:8px;pointer-events:none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const BG = { success: '#1A7A4A', error: '#C53030', warn: '#B45309' };

export function toast(msg: string, type: 'success' | 'error' | 'warn' = 'success') {
  const container = getContainer();
  const el = document.createElement('div');
  el.style.cssText = `
    display:flex;align-items:center;gap:9px;
    background:${BG[type]};color:#fff;
    padding:10px 14px;border-radius:12px;
    font-size:13px;font-family:DM Sans,sans-serif;font-weight:500;
    box-shadow:0 4px 20px rgba(0,0,0,.18),0 1px 4px rgba(0,0,0,.1);
    max-width:320px;pointer-events:all;
    opacity:0;transform:translateY(8px) scale(0.97);
    transition:opacity .2s ease,transform .2s ease;
  `;
  el.innerHTML = `${TOAST_ICONS[type]}<span>${msg}</span>`;
  container.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px) scale(0.97)';
    setTimeout(() => { el.remove(); }, 220);
  }, 3500);
}

// ── AgeingBar ────────────────────────────────────────────────────
export function AgeingBar({ total, non_echu, echu_30j, echu_60j, contentieux }: {
  total: number; non_echu: number; echu_30j: number; echu_60j: number; contentieux: number;
}) {
  if (!total) return null;
  const pct = (v: number) => Math.max(0, Math.round((v / total) * 100));
  const segments = [
    { color: 'bg-emerald-500', label: 'Non échu',    val: non_echu },
    { color: 'bg-amber-400',   label: 'Échu ≤30j',   val: echu_30j },
    { color: 'bg-red-400',     label: 'Échu ≤60j',   val: echu_60j },
    { color: 'bg-red-700',     label: 'Contentieux', val: contentieux },
  ];
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {segments.map(s => (
          <div key={s.label} className={`${s.color} transition-all duration-500`} style={{ width: `${pct(s.val)}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map(s => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-[#6B6862]">
            <span className={`w-2 h-2 rounded-sm ${s.color} flex-shrink-0`} />
            <span>{s.label}</span>
            <span className="font-mono text-[10px] text-[#A8A49E]">
              {Math.round(s.val).toLocaleString('fr-CI')} F
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
