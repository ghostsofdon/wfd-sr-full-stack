import { useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { SignalsAccordion } from './SignalsAccordion';
import { useTriggerRenewalEvent } from '../hooks/useRenewalRisk';
import type { RiskEntry } from '../types/api';

interface ResidentRowProps {
  entry: RiskEntry;
  propertyId: string;
}

export function ResidentRow({ entry, propertyId }: ResidentRowProps) {
  const [triggered, setTriggered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { mutate, isPending } = useTriggerRenewalEvent(propertyId);

  const handleTrigger = () => {
    if (triggered) return;
    setErrorMsg(null);
    mutate(
      { residentId: entry.residentId, eventType: 'renewal_notice_sent' },
      {
        onSuccess: () => setTriggered(true),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Failed to send renewal event';
          setErrorMsg(msg);
        },
      }
    );
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const fmtMoney = (val: number | null) => {
    if (val === null) return '—';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      {/* Name / email */}
      <td className="py-4 pl-6 pr-4">
        <p className="font-medium text-slate-900">{entry.name}</p>
        {entry.email && (
          <p className="text-xs text-slate-400 mt-0.5">{entry.email}</p>
        )}
      </td>

      {/* Unit */}
      <td className="py-4 px-4 text-sm text-slate-700 font-mono">
        {entry.unitNumber}
      </td>

      {/* Risk */}
      <td className="py-4 px-4">
        <RiskBadge tier={entry.riskTier} score={entry.riskScore} />
      </td>

      {/* Lease end */}
      <td className="py-4 px-4 text-sm text-slate-700">
        <span>{fmtDate(entry.leaseEndDate)}</span>
        {entry.daysToExpiry !== null && (
          <span
            className={`ml-2 text-xs font-medium ${
              entry.daysToExpiry <= 30
                ? 'text-red-600'
                : entry.daysToExpiry <= 90
                ? 'text-amber-600'
                : 'text-slate-400'
            }`}
          >
            ({entry.daysToExpiry}d)
          </span>
        )}
      </td>

      {/* Rent / market */}
      <td className="py-4 px-4 text-sm">
        <span className="text-slate-700">{fmtMoney(entry.monthlyRent)}</span>
        {entry.marketRent && (
          <span className="ml-1 text-slate-400 text-xs">
            / {fmtMoney(entry.marketRent)} mkt
          </span>
        )}
      </td>

      {/* Signals accordion */}
      <td className="py-4 px-4">
        <SignalsAccordion
          signals={entry.signals}
          daysToExpiry={entry.daysToExpiry}
          monthlyRent={entry.monthlyRent}
          marketRent={entry.marketRent}
        />
      </td>

      {/* Action */}
      <td className="py-4 pl-4 pr-6 text-right">
        {triggered ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Event Sent
          </span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleTrigger}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-busy={isPending}
              aria-label={`Trigger renewal event for ${entry.name}`}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              {isPending ? 'Sending…' : 'Trigger Event'}
            </button>
            {errorMsg && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {errorMsg}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
