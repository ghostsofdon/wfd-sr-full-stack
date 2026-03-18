import { RiskBadge } from './RiskBadge';
import { SignalsAccordion } from './SignalsAccordion';
import type { RiskEntry } from '../types/api';

interface ResidentRowProps {
  entry: RiskEntry;
}

export function ResidentRow({ entry }: ResidentRowProps) {
  const fmtMoney = (val: number | null) => {
    if (val === null) return '—';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  const daysToExpiry = entry.signals?.daysToExpiry ?? null;
  const currentRent = entry.signals?.currentRent ?? null;
  const marketRent = entry.signals?.marketRent ?? null;

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
        {entry.unitId ?? '—'}
      </td>

      {/* Risk */}
      <td className="py-4 px-4">
        <RiskBadge tier={entry.riskTier} score={entry.riskScore} />
      </td>

      {/* Days to expiry */}
      <td className="py-4 px-4 text-sm text-slate-700">
        {daysToExpiry !== null ? (
          <>
            <span
              className={`font-mono text-xs font-medium ${daysToExpiry <= 30
                  ? 'text-red-600'
                  : daysToExpiry <= 90
                    ? 'text-amber-600'
                    : 'text-slate-600'
                }`}
            >
              {daysToExpiry}d
            </span>
            <span className="ml-1 text-slate-400 text-xs">remaining</span>
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Rent / market */}
      <td className="py-4 px-4 text-sm">
        <span className="text-slate-700">{fmtMoney(currentRent)}</span>
        {marketRent !== null && (
          <span className="ml-1 text-slate-400 text-xs">
            / {fmtMoney(marketRent)} mkt
          </span>
        )}
      </td>

      {/* Signals accordion */}
      <td className="py-4 px-4">
        {entry.signals ? (
          <SignalsAccordion signals={entry.signals} />
        ) : (
          <span className="text-xs text-slate-300">No signals</span>
        )}
      </td>

      {/* Score */}
      <td className="py-4 pl-4 pr-6 text-right">
        <span className="font-mono text-sm font-semibold text-slate-700">
          {(entry.riskScore).toFixed(0)}
          <span className="text-xs font-normal text-slate-400">/100</span>
        </span>
      </td>
    </tr>
  );
}
