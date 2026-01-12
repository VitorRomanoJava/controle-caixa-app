import { useMemo, useState } from "react";
import {
  getMonthSummary,
  listMonths,
  type CategoryTotal,
  type MonthSummary,
} from "../lib/tauriApi";
import { formatCompetencyPtBr, formatCurrency } from "../lib/format";
import { isTauriApp } from "../lib/tauriEnv";

const buildMonthOptions = (base: string, compare: string, available: string[]) => {
  const set = new Set(available);
  set.add(base);
  set.add(compare);
  return Array.from(set).sort().reverse();
};

const previousMonth = (competency: string) => {
  const [yearRaw, monthRaw] = competency.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) {
    return competency;
  }
  const prev = new Date(year, month - 2, 1);
  const prevYear = prev.getFullYear();
  const prevMonth = String(prev.getMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}`;
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
};

type ComparisonMetric = {
  label: string;
  base: number;
  compare: number;
  diff: number;
  percent: number | null;
};

type ComparisonTableRow = {
  category: string;
  base: number;
  compare: number;
  diff: number;
};

const buildCategoryRows = (
  base: CategoryTotal[],
  compare: CategoryTotal[]
): ComparisonTableRow[] => {
  const baseMap = new Map(base.map((item) => [item.category, item.total]));
  const compareMap = new Map(compare.map((item) => [item.category, item.total]));
  const categories = new Set([...baseMap.keys(), ...compareMap.keys()]);

  return Array.from(categories)
    .map((category) => {
      const baseTotal = baseMap.get(category) ?? 0;
      const compareTotal = compareMap.get(category) ?? 0;
      return {
        category,
        base: baseTotal,
        compare: compareTotal,
        diff: baseTotal - compareTotal,
      };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
};

const buildMetrics = (base: MonthSummary, compare: MonthSummary): ComparisonMetric[] => {
  const makeMetric = (label: string, baseValue: number, compareValue: number) => {
    const diff = baseValue - compareValue;
    const percent = compareValue !== 0 ? (diff / compareValue) * 100 : null;
    return { label, base: baseValue, compare: compareValue, diff, percent };
  };

  return [
    makeMetric("Entradas", base.total_in, compare.total_in),
    makeMetric("Saídas", base.total_out, compare.total_out),
    makeMetric("Saldo", base.closing_balance, compare.closing_balance),
  ];
};

const buildCsv = (
  baseLabel: string,
  compareLabel: string,
  metrics: ComparisonMetric[],
  categoryRowsIn: ComparisonTableRow[],
  categoryRowsOut: ComparisonTableRow[]
) => {
  const lines: string[] = [];
  lines.push(`Resumo;${baseLabel};${compareLabel};Diferenca;Percentual`);
  metrics.forEach((metric) => {
    lines.push(
      [
        metric.label,
        (metric.base / 100).toFixed(2),
        (metric.compare / 100).toFixed(2),
        (metric.diff / 100).toFixed(2),
        metric.percent === null ? "" : metric.percent.toFixed(1),
      ]
        .map((cell) => `"${cell}"`)
        .join(";")
    );
  });

  lines.push("");
  lines.push("Entradas por categoria;Base;Comparar;Diferença");
  categoryRowsIn.forEach((row) => {
    lines.push(
      [
        row.category,
        (row.base / 100).toFixed(2),
        (row.compare / 100).toFixed(2),
        (row.diff / 100).toFixed(2),
      ]
        .map((cell) => `"${cell}"`)
        .join(";")
    );
  });

  lines.push("");
  lines.push("Saídas por categoria;Base;Comparar;Diferença");
  categoryRowsOut.forEach((row) => {
    lines.push(
      [
        row.category,
        (row.base / 100).toFixed(2),
        (row.compare / 100).toFixed(2),
        (row.diff / 100).toFixed(2),
      ]
        .map((cell) => `"${cell}"`)
        .join(";")
    );
  });

  return lines.join("\n");
};

const buildPdfHtml = (
  baseLabel: string,
  compareLabel: string,
  metrics: ComparisonMetric[],
  categoryRowsIn: ComparisonTableRow[],
  categoryRowsOut: ComparisonTableRow[]
) => {
  const metricRows = metrics
    .map(
      (metric) =>
        `<tr><td>${metric.label}</td><td>${formatCurrency(
          metric.base
        )}</td><td>${formatCurrency(metric.compare)}</td><td>${formatCurrency(
          metric.diff
        )}</td><td>${formatPercent(metric.percent)}</td></tr>`
    )
    .join("");

  const categorySection = (title: string, rows: ComparisonTableRow[]) => {
    const body = rows
      .map(
        (row) =>
          `<tr><td>${row.category}</td><td>${formatCurrency(
            row.base
          )}</td><td>${formatCurrency(
            row.compare
          )}</td><td>${formatCurrency(row.diff)}</td></tr>`
      )
      .join("");

    return `<h2>${title}</h2>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Base</th>
            <th>Comparar</th>
            <th>Diferenca</th>
          </tr>
        </thead>
        <tbody>
          ${body || "<tr><td colspan='4'>Sem dados.</td></tr>"}
        </tbody>
      </table>`;
  };

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Comparativo mensal</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        h2 { font-size: 16px; margin: 24px 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        th { font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.02em; }
      </style>
    </head>
    <body>
      <h1>Comparativo mensal</h1>
      <p>Base: ${baseLabel} | Comparar: ${compareLabel}</p>
      <table>
        <thead>
          <tr>
            <th>Resumo</th>
            <th>Base</th>
            <th>Comparar</th>
            <th>Diferenca</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${metricRows || "<tr><td colspan='5'>Sem dados.</td></tr>"}
        </tbody>
      </table>
      ${categorySection("Entradas por categoria", categoryRowsIn)}
      ${categorySection("Saídas por categoria", categoryRowsOut)}
    </body>
  </html>`;
};

const formatDelta = (value: number) =>
  `${value >= 0 ? "+" : ""}${formatCurrency(value)}`;

const formatPercentBadge = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return { label: "N/A", trend: "neutral" as const };
  }
  if (value > 0) {
    return { label: `▲ ${formatPercent(value)}`, trend: "up" as const };
  }
  if (value < 0) {
    return { label: `▼ ${formatPercent(value)}`, trend: "down" as const };
  }
  return { label: "0%", trend: "neutral" as const };
};

const percentFromDiff = (diff: number, compare: number) =>
  compare !== 0 ? (diff / compare) * 100 : null;

type MonthlyComparisonProps = {
  competency: string;
  showValues: boolean;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
};

function MonthlyComparison({ competency, showValues, onToast }: MonthlyComparisonProps) {
  const [baseMonth, setBaseMonth] = useState(competency);
  const [compareMonth, setCompareMonth] = useState(previousMonth(competency));
  const [options, setOptions] = useState<string[]>([]);
  const [baseSummary, setBaseSummary] = useState<MonthSummary | null>(null);
  const [compareSummary, setCompareSummary] = useState<MonthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryTab, setCategoryTab] = useState<"in" | "out">("in");

  const canUseTauri = isTauriApp();

  const months = useMemo(
    () => buildMonthOptions(baseMonth, compareMonth, options),
    [baseMonth, compareMonth, options]
  );

  const metrics = useMemo(() => {
    if (!baseSummary || !compareSummary) {
      return [];
    }
    return buildMetrics(baseSummary, compareSummary);
  }, [baseSummary, compareSummary]);

  const categoryRowsIn = useMemo(() => {
    if (!baseSummary || !compareSummary) {
      return [];
    }
    return buildCategoryRows(baseSummary.by_category_in, compareSummary.by_category_in);
  }, [baseSummary, compareSummary]);

  const categoryRowsOut = useMemo(() => {
    if (!baseSummary || !compareSummary) {
      return [];
    }
    return buildCategoryRows(baseSummary.by_category_out, compareSummary.by_category_out);
  }, [baseSummary, compareSummary]);

  const loadMonths = async () => {
    if (!canUseTauri) {
      return;
    }
    try {
      const data = await listMonths();
      setOptions(data);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao carregar meses.",
        "error"
      );
    }
  };

  const handleCompare = async () => {
    if (!canUseTauri) {
      onToast("Comparativo disponivel apenas no app.", "info");
      return;
    }
    setIsLoading(true);
    try {
      const [base, compare] = await Promise.all([
        getMonthSummary(baseMonth),
        getMonthSummary(compareMonth),
      ]);
      setBaseSummary(base);
      setCompareSummary(compare);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao comparar meses.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const categoryRows = categoryTab === "in" ? categoryRowsIn : categoryRowsOut;
  const formatMaybe = (value: number) => (showValues ? formatCurrency(value) : "•••");

  const handleExport = () => {
    if (!baseSummary || !compareSummary || metrics.length === 0) {
      onToast("Sem dados para exportar.", "info");
      return;
    }

    const csv = buildCsv(
      formatCompetencyPtBr(baseMonth),
      formatCompetencyPtBr(compareMonth),
      metrics,
      categoryRowsIn,
      categoryRowsOut
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comparativo-${baseMonth}-vs-${compareMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onToast("CSV exportado.", "success");
  };

  const handleExportPdf = () => {
    if (!baseSummary || !compareSummary || metrics.length === 0) {
      onToast("Sem dados para exportar.", "info");
      return;
    }

    const html = buildPdfHtml(
      formatCompetencyPtBr(baseMonth),
      formatCompetencyPtBr(compareMonth),
      metrics,
      categoryRowsIn,
      categoryRowsOut
    );
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    const cleanup = () => {
      iframe.remove();
    };

    iframe.onload = () => {
      const target = iframe.contentWindow;
      if (!target) {
        cleanup();
        onToast("Nao foi possivel abrir a janela de impressao.", "error");
        return;
      }
      target.focus();
      target.print();
      setTimeout(cleanup, 500);
    };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">
              Comparativo mensal
            </p>
            <h3 className="text-xl font-semibold text-slate-900">
              {formatCompetencyPtBr(baseMonth)} vs {formatCompetencyPtBr(compareMonth)}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {baseMonth} vs {compareMonth}
            </span>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canUseTauri || metrics.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="min-w-[180px] flex-1">
          <label className="text-xs font-semibold uppercase text-slate-400">
            Mes base
          </label>
          <select
            value={baseMonth}
            onChange={(event) => setBaseMonth(event.target.value)}
            onFocus={loadMonths}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {formatCompetencyPtBr(month)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="text-xs font-semibold uppercase text-slate-400">
            Comparar com
          </label>
          <select
            value={compareMonth}
            onChange={(event) => setCompareMonth(event.target.value)}
            onFocus={loadMonths}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {formatCompetencyPtBr(month)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleCompare}
          disabled={!canUseTauri || isLoading}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Comparando..." : "Comparar"}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!canUseTauri || metrics.length === 0}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-soft transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar Planilha
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!canUseTauri}
            className="rounded-2xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 shadow-soft transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar PDF
          </button>
        </div>
        {!canUseTauri ? (
          <span className="text-xs text-slate-400">
            Disponivel apenas no app.
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-slate-100 bg-white p-6 text-sm text-slate-400">
            Selecione os meses e clique em Comparar.
          </div>
        ) : (
          metrics.map((metric) => {
            const badge = formatPercentBadge(metric.percent);
            const badgeStyles =
              badge.trend === "up"
                ? "bg-emerald-50 text-emerald-700"
                : badge.trend === "down"
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-600";

            return (
              <div
                key={metric.label}
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft"
              >
                <p className="text-sm font-semibold text-slate-500">
                  {metric.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {formatMaybe(metric.base)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Comparado: {formatMaybe(metric.compare)}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles}`}
                  >
                    {badge.label}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      metric.diff > 0
                        ? "text-emerald-600"
                        : metric.diff < 0
                        ? "text-rose-600"
                        : "text-slate-500"
                    }`}
                  >
                    {showValues ? formatDelta(metric.diff) : "•••"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Categorias
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Comparativo por categoria.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600 shadow-soft">
            <button
              type="button"
              onClick={() => setCategoryTab("in")}
              className={`rounded-2xl px-3 py-1 ${
                categoryTab === "in"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-500"
              }`}
            >
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("out")}
              className={`rounded-2xl px-3 py-1 ${
                categoryTab === "out"
                  ? "bg-rose-600 text-white"
                  : "text-slate-500"
              }`}
            >
              Saídas
            </button>
          </div>
        </div>

        {categoryRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            Sem dados para este comparativo.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr,1fr] gap-2 text-xs font-semibold uppercase text-slate-400">
              <span>Categoria</span>
              <span>Base</span>
              <span>Comparar</span>
              <span>Dif (R$)</span>
              <span>Dif (%)</span>
            </div>
            {categoryRows.map((row) => {
              const percent = percentFromDiff(row.diff, row.compare);
              return (
                <div
                  key={`${categoryTab}-${row.category}`}
                  className="grid grid-cols-[1.5fr,1fr,1fr,1fr,1fr] items-center gap-2 rounded-2xl border border-slate-100 px-3 py-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">
                      {row.category}
                    </span>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${
                          row.diff >= 0 ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(row.diff) /
                              Math.max(1, Math.abs(row.base), Math.abs(row.compare)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-slate-500">
                    {formatMaybe(row.base)}
                  </span>
                  <span className="text-slate-500">
                    {formatMaybe(row.compare)}
                  </span>
                  <span
                    className={`font-semibold ${
                      row.diff >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {showValues ? formatDelta(row.diff) : "•••"}
                  </span>
                  <span className="text-slate-500">
                    {formatPercent(percent)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonthlyComparison;
