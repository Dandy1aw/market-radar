type BadgeVariant = 'positive' | 'negative' | 'warning' | 'neutral' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  positive: 'text-green-400 bg-green-400/10 border-green-400/20',
  negative: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  neutral:  'text-gray-400 bg-gray-400/10 border-gray-400/20',
  info:     'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
};

export function Badge({ variant, label, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[variant]} ${className}`}>
      {label}
    </span>
  );
}
