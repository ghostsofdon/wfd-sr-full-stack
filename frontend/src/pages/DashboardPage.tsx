import { useState } from 'react';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  TrendingUp,
  ShieldAlert,
  Filter,
} from 'lucide-react';
import { useRenewalRisk, useRunBatchScoring } from '../hooks/useRenewalRisk';
import { ResidentRow } from '../components/ResidentRow';
import { StatCard } from '../components/StatCard';
import type { RiskTier } from '../types/api';

// Hardcoded for demonstration — in production this would come from auth/context
const PROPERTY_ID = import.meta.env.VITE_PROPERTY_ID ?? '';

const TIER_ORDER: RiskTier[] = ['high', 'medium', 'low'];

type TierFilter = 'all' | RiskTier;

export function DashboardPage() {
  const [filter, setFilter] = useState<TierFilter>('all');
  const [lastBatchAt, setLastBatchAt] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useRenewalRisk(PROPERTY_ID || null);
  const { mutate: runBatch, isPending: isCalculating } = useRunBatchScoring(PROPERTY_ID);

  const handleCalculate = () => {
    runBatch(undefined, {
      onSuccess: (result) => setLastBatchAt(result.asOfDate),
    });
  };

  // Derive stats from the paginated results list
  const results = data?.results ?? [];
  const totalScored = data?.total ?? 0;
  const highCount = results.filter((r) => r.riskTier === 'high').length;
  const mediumCount = results.filter((r) => r.riskTier === 'medium').length;
  const atRiskCount = results.filter((r) => r.riskTier !== 'low').length;

  const filteredResults = results.filter(
    (r) => filter === 'all' || r.riskTier === filter
  );

  if (!PROPERTY_ID) {
    return (
      <ErrorBanner
        title="Configuration required"
        message="Set VITE_PROPERTY_ID in your .env file to the target property ID."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Renewal Risk Dashboard
              </h1>
              {lastBatchAt && (
                <p className="text-xs text-slate-400">
                  Last scored:{' '}
                  {new Date(lastBatchAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-busy={isCalculating}
          >
            {isCalculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isCalculating ? 'Calculating…' : 'Run Risk Calculation'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* ─── Loading state ─────────────────────────────────────────────── */}
        {isLoading && (
          <div
            className="flex items-center justify-center py-20 text-slate-400"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span className="text-sm">Loading risk scores…</span>
          </div>
        )}

        {/* ─── Error state ───────────────────────────────────────────────── */}
        {isError && (
          <ErrorBanner
            title="Failed to load risk data"
            message={error instanceof Error ? error.message : 'An unexpected error occurred.'}
            action={
              <p className="mt-2 text-sm text-amber-700">
                No scores yet? Click <strong>Run Risk Calculation</strong> above to generate them.
              </p>
            }
          />
        )}

        {/* ─── Summary stats ─────────────────────────────────────────────── */}
        {data && (
          <>
            <section aria-label="Summary statistics">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  label="Total Scored"
                  value={totalScored}
                  icon={<Building2 className="h-6 w-6" />}
                  accent="blue"
                />
                <StatCard
                  label="At-Risk"
                  value={atRiskCount}
                  icon={<ShieldAlert className="h-6 w-6" />}
                  accent="red"
                  subtitle={`${Math.round((atRiskCount / Math.max(results.length, 1)) * 100)}% of page`}
                />
                <StatCard
                  label="High Risk"
                  value={highCount}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  accent="red"
                />
                <StatCard
                  label="Medium Risk"
                  value={mediumCount}
                  icon={<TrendingUp className="h-6 w-6" />}
                  accent="amber"
                />
              </div>
            </section>

            {/* ─── Filter bar ─────────────────────────────────────────────── */}
            <section aria-label="Filter residents by risk tier">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
                <div className="flex gap-1.5 flex-wrap">
                  {(['all', ...TIER_ORDER] as const).map((tier) => {
                    const count =
                      tier === 'all'
                        ? results.length
                        : results.filter((r) => r.riskTier === tier).length;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setFilter(tier)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors border ${
                          filter === tier
                            ? tier === 'all'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : tier === 'high'
                              ? 'bg-red-600 text-white border-red-600'
                              : tier === 'medium'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                        aria-pressed={filter === tier}
                        aria-label={`Filter: ${tier === 'all' ? 'All' : tier} (${count})`}
                      >
                        {tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1)}{' '}
                        <span className="opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ─── Resident table ─────────────────────────────────────────── */}
            <section aria-label="Flagged residents">
              {filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                  <ClipboardCheck className="h-10 w-10 text-emerald-400 mb-3" />
                  <p className="text-slate-700 font-semibold">No residents match this filter</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {filter === 'all'
                      ? 'Run a calculation first to detect at-risk residents.'
                      : `No ${filter}-risk residents found.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left" aria-label="Flagged residents table">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {[
                          'Resident',
                          'Unit',
                          'Risk',
                          'Days Left',
                          'Rent',
                          'Signals',
                          'Score',
                        ].map((col) => (
                          <th
                            key={col}
                            className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500 first:pl-6 last:pr-6 last:text-right"
                            scope="col"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((entry) => (
                        <ResidentRow
                          key={entry.id}
                          entry={entry}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ─── ErrorBanner helper ───────────────────────────────────────────────────────

function ErrorBanner({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-900">{title}</p>
        <p className="text-sm text-amber-800 mt-0.5">{message}</p>
        {action}
      </div>
    </div>
  );
}
