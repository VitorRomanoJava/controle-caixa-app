import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/format";
import { listTransactions, type Transaction } from "../lib/tauriApi";
import MonthlyComparison from "../components/MonthlyComparison";
import { formatCompetencyPtBr } from "../lib/format";
import VisibilityToggle from "../components/VisibilityToggle";

type RelatoriosProps = {
  competency: string;
  refreshKey: number;
  showValues: boolean;
  onToggleValues: () => void;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
};

const buildCsv = (transactions: Transaction[]) => {
  const header = [
    "date",
    "type",
    "description",
    "category",
    "payment_method",
    "amount",
    "notes",
  ];
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type,
    transaction.description,
    transaction.category ?? "",
    transaction.payment_method ?? "",
    (transaction.amount / 100).toFixed(2),
    transaction.notes ?? "",
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");
};

const buildPdfHtml = (
  competency: string,
  totalsByCategory: [string, number][]
) => {
  const title = `Relatório mensal - ${formatCompetencyPtBr(competency)}`;
  const rows = totalsByCategory
    .map(
      ([category, total]) =>
        `<tr><td>${category}</td><td>${formatCurrency(total)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        th { font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.02em; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || "<tr><td colspan='2'>Sem dados.</td></tr>"}
        </tbody>
      </table>
    </body>
  </html>`;
};

function Relatorios({
  competency,
  refreshKey,
  showValues,
  onToggleValues,
  onToast,
}: RelatoriosProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"resumo" | "comparativo">(
    "resumo"
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await listTransactions({ competency });
        if (!active) {
          return;
        }
        setTransactions(data);
        setIsLoading(false);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(
        error instanceof Error ? error.message : "Erro ao carregar relatórios."
        );
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [competency, refreshKey]);

  const totalsByCategory = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const transaction of transactions) {
      const key = transaction.category?.trim() || "Sem categoria";
      const current = buckets.get(key) ?? 0;
      const signedAmount =
        transaction.type === "OUT" ? -transaction.amount : transaction.amount;
      buckets.set(key, current + signedAmount);
    }
    return Array.from(buckets.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [transactions]);

  const handleExport = () => {
    if (transactions.length === 0) {
      onToast("Sem dados para exportar.", "info");
      return;
    }
    const csv = buildCsv(transactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `controle-caixa-${competency}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onToast("CSV exportado.", "success");
  };

  const formatMaybe = (value: number) => (showValues ? formatCurrency(value) : "•••");

  const handleExportPdf = () => {
    const html = buildPdfHtml(competency, totalsByCategory);
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
    <div className="space-y-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Relatórios</h2>
          <p className="mt-2 text-sm text-slate-500">
            {activeTab === "comparativo"
              ? "Comparativo mensal."
              : "Totais do mês agrupados por categoria."}
          </p>
        </div>
        <VisibilityToggle visible={showValues} onToggle={onToggleValues} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-1 text-sm font-semibold text-slate-600 shadow-soft">
            <button
              type="button"
              onClick={() => setActiveTab("resumo")}
              className={`rounded-2xl px-3 py-1 ${
                activeTab === "resumo"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500"
              }`}
            >
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("comparativo")}
              className={`rounded-2xl px-3 py-1 ${
                activeTab === "comparativo"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500"
              }`}
            >
              Comparativo
            </button>
          </div>
          {activeTab === "resumo" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-soft transition hover:bg-emerald-100"
              >
                Exportar Planilha
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="rounded-2xl border border-rose-200 bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 shadow-soft transition hover:bg-rose-200"
              >
                Exportar PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}

      {activeTab === "resumo" ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          {isLoading ? (
            <p className="text-sm text-slate-400">Carregando relatório...</p>
          ) : totalsByCategory.length === 0 ? (
            <p className="text-sm text-slate-400">Sem dados para este mês.</p>
          ) : (
            <div className="space-y-4">
              {totalsByCategory.map(([category, total]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {category}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      total >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {total >= 0 ? "+" : ""}
                    {formatMaybe(total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <MonthlyComparison
          competency={competency}
          onToast={onToast}
          showValues={showValues}
        />
      )}
    </div>
  );
}

export default Relatorios;
