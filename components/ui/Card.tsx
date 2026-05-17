interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4
        ${hover ? 'transition-colors hover:bg-[var(--bg-card-hover)] hover:border-indigo-500/30' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
