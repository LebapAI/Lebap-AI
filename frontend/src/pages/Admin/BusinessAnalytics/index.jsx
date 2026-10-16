import Sidebar from "@/components/SettingsSidebar";
import { useEffect, useMemo, useState } from "react";
import { isMobile } from "react-device-detect";
import { ChartLineUp, ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { fullApiUrl } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

function dateInput(date) {
  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function MetricCard({ label, value, detail = null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-theme-bg-primary p-5">
      <p className="text-xs uppercase tracking-wide text-theme-text-secondary">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-theme-text-primary break-words">{value}</p>
      {detail && <p className="mt-2 text-xs text-theme-text-secondary">{detail}</p>}
    </div>
  );
}

function BreakdownTable({ title, rows, nameKey, showTokens = false }) {
  return (
    <section className="rounded-xl border border-white/10 bg-theme-bg-primary p-5 min-w-0">
      <h2 className="text-base font-semibold text-theme-text-primary mb-4">{title}</h2>
      {!rows?.length ? (
        <p className="text-sm text-theme-text-secondary">No recorded data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-theme-text-secondary border-b border-white/10">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium text-right">Requests</th>
                {showTokens && <th className="py-2 font-medium text-right">Tokens</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row[nameKey]) + index} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-4 text-theme-text-primary break-all">{row[nameKey]}</td>
                  <td className="py-3 pr-4 text-right text-theme-text-primary">{formatNumber(row.requests)}</td>
                  {showTokens && <td className="py-3 text-right text-theme-text-primary">{formatNumber(row.totalTokens)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function BusinessAnalytics() {
  const today = useMemo(() => new Date(), []);
  const [to, setTo] = useState(dateInput(today));
  const [from, setFrom] = useState(dateInput(new Date(today.getTime() - 29 * 86400000)));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: new Date(from + "T00:00:00.000Z").toISOString(),
        to: new Date(to + "T23:59:59.999Z").toISOString(),
      });
      const response = await fetch(
        `${fullApiUrl()}/v1/admin/business-analytics?${params.toString()}`,
        { headers: baseHeaders() }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load business analytics.");
      setData(result);
    } catch (e) {
      setError(e.message || "Unable to load business analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAnalytics(); }, []);

  const activity = data?.activity;
  const costs = data?.estimatedCosts;
  const platform = data?.platform;

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <main
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-auto p-4 md:p-0"
      >
        <div className="w-full max-w-[1500px] mx-auto px-1 md:px-8 md:py-8 py-16">
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-3">
                <ChartLineUp className="w-7 h-7 text-[#0066FF]" />
                <h1 className="text-2xl font-bold text-theme-text-primary">Business Analytics</h1>
              </div>
              <p className="mt-2 text-sm text-theme-text-secondary">
                Operational metrics from recorded API activity. Financial values are shown only when verified data exists.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-theme-text-secondary flex flex-col gap-1">
                From
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-white/15 bg-theme-bg-primary px-3 py-2 text-sm text-theme-text-primary" />
              </label>
              <label className="text-xs text-theme-text-secondary flex flex-col gap-1">
                To
                <input type="date" value={to} min={from} max={dateInput(today)} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-white/15 bg-theme-bg-primary px-3 py-2 text-sm text-theme-text-primary" />
              </label>
              <button onClick={loadAnalytics} disabled={loading || !from || !to || from > to} className="inline-flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0040CC] disabled:opacity-50">
                <ArrowClockwise className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </header>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-theme-text-primary">
              <WarningCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <div><p className="font-semibold">Analytics unavailable</p><p className="mt-1 text-theme-text-secondary">{error}</p></div>
            </div>
          )}

          {data?.dataQuality?.usageLedgerEnabled === false && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-theme-text-secondary">
              Usage collection is disabled. These figures may be empty or incomplete. Enable it only after the usage-ledger database migration and Prisma Client generation are verified.
            </div>
          )}

          {loading && !data ? (
            <div className="mt-8 text-sm text-theme-text-secondary">Loading analytics…</div>
          ) : data ? (
            <>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard label="API requests" value={formatNumber(activity?.requests)} detail={`${formatNumber(activity?.completed)} completed`} />
                <MetricCard label="Completion rate" value={activity?.successRate == null ? "—" : `${activity.successRate}%`} detail={`${formatNumber(activity?.failed)} failed · ${formatNumber(activity?.aborted)} aborted`} />
                <MetricCard label="Tokens recorded" value={formatNumber(data.tokens?.total)} detail={`${formatNumber(data.tokens?.input)} input · ${formatNumber(data.tokens?.output)} output`} />
                <MetricCard label="Average latency" value={activity?.averageLatencyMs == null ? "—" : `${formatNumber(activity.averageLatencyMs)} ms`} detail={`${formatNumber(activity?.inProgress)} in progress`} />
                <MetricCard label="Estimated AI cost" value={costs?.total == null ? "Not available" : new Intl.NumberFormat(undefined, { style: "currency", currency: costs.currency || "USD" }).format(costs.total)} detail={`${costs?.coveragePercent ?? 0}% of recorded events have known cost`} />
                <MetricCard label="Users" value={formatNumber(platform?.totalUsers)} detail={`${formatNumber(platform?.activeUsers)} not suspended`} />
                <MetricCard label="Workspaces" value={formatNumber(platform?.totalWorkspaces)} />
                <MetricCard label="API keys" value={formatNumber(platform?.totalApiKeys)} detail="Total stored keys, including revoked and legacy records" />
              </div>

              <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BreakdownTable title="Top models" rows={data.topModels} nameKey="model" showTokens />
                <BreakdownTable title="Top providers" rows={data.topProviders} nameKey="provider" />
              </div>

              <section className="mt-6 rounded-xl border border-white/10 bg-theme-bg-primary p-5">
                <h2 className="text-base font-semibold text-theme-text-primary">Financial overview</h2>
                <p className="mt-2 text-sm text-theme-text-secondary">{data.financials?.note || "Financial reporting is not configured."}</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard label="Revenue" value="Not connected" detail="Requires billing/invoice data" />
                  <MetricCard label="AI cost" value={costs?.total == null ? "Unknown" : new Intl.NumberFormat(undefined, { style: "currency", currency: costs.currency || "USD" }).format(costs.total)} detail="Only events with verified cost are included" />
                  <MetricCard label="Profit" value="Not available" detail="Requires revenue and operating costs" />
                </div>
              </section>
              <p className="mt-4 text-xs text-theme-text-secondary">
                Data range: {data.range?.from ? new Date(data.range.from).toLocaleString() : from} — {data.range?.to ? new Date(data.range.to).toLocaleString() : to}. Historical requests before metering was enabled are not backfilled.
              </p>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
