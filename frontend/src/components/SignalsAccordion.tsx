import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import type { RiskSignals } from '../types/api';

interface SignalsAccordionProps {
  signals: RiskSignals;
}

interface SignalRow {
  label: string;
  value: boolean;
  detail?: string;
}

export function SignalsAccordion({ signals }: SignalsAccordionProps) {
  const [open, setOpen] = useState(false);

  const rows: SignalRow[] = [
    {
      label: 'Lease expiring soon',
      value: signals.daysToExpiry !== null && signals.daysToExpiry <= 90,
      detail:
        signals.daysToExpiry !== null ? `${signals.daysToExpiry} days remaining` : 'Unknown',
    },
    {
      label: 'Payment delinquency',
      value: signals.paymentHistoryDelinquent,
      detail: signals.paymentHistoryDelinquent ? 'Has outstanding balance' : 'Payments current',
    },
    {
      label: 'No renewal offer sent',
      value: signals.noRenewalOfferYet,
      detail: signals.noRenewalOfferYet ? 'Renewal offer pending' : 'Offer already sent',
    },
    {
      label: 'Rent below market',
      value: signals.rentGrowthAboveMarket,
      detail:
        signals.marketRent !== null
          ? `$${signals.currentRent.toFixed(0)}/mo vs $${signals.marketRent.toFixed(0)}/mo market`
          : 'Market rent unavailable',
    },
  ];

  const activeCount = rows.filter((r) => r.value).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        aria-expanded={open}
        aria-controls="signals-detail"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {activeCount} active signal{activeCount !== 1 ? 's' : ''} — click to expand
      </button>

      {open && (
        <ul
          id="signals-detail"
          className="mt-2 space-y-1 animate-fade-in"
          role="list"
          aria-label="Risk signals"
        >
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-2 text-xs text-slate-600">
              {row.value ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
              ) : (
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              )}
              <span>
                <span className={row.value ? 'font-medium text-slate-800' : ''}>{row.label}</span>
                {row.detail && <span className="ml-1 text-slate-400">— {row.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
