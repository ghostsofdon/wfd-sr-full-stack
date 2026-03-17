import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: 'red' | 'amber' | 'green' | 'blue';
  subtitle?: string;
}

const ACCENT_STYLES = {
  red: 'bg-red-50 border-red-200 text-red-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
};

export function StatCard({ label, value, icon, accent = 'blue', subtitle }: StatCardProps) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-4 ${ACCENT_STYLES[accent]}`}
      role="region"
      aria-label={label}
    >
      <div className="shrink-0 text-2xl" aria-hidden="true">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium opacity-80">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs opacity-70">{subtitle}</p>}
      </div>
    </div>
  );
}
