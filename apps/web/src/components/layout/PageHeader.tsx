interface PageHeaderProps {
  title:    string;
  subtitle?: string;
  action?:  React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-black/[0.07] px-4 sm:px-6 py-3 sm:py-3.5"
         style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <h1 className="text-[14px] sm:text-[15px] font-semibold text-[#1A1917] leading-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] font-mono text-[#B0ABA5] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex items-center gap-2 flex-shrink-0">{action}</div>
        )}
      </div>
    </div>
  );
}
