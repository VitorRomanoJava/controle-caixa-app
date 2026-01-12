import { useEffect, useMemo, useState } from "react";
import SummaryCards from "../components/SummaryCards";
import TransactionTable from "../components/TransactionTable";
import VisibilityToggle from "../components/VisibilityToggle";
import {
  getMonthSummary,
  listTransactions,
  type MonthSummary,
  type Transaction,
} from "../lib/tauriApi";
import { formatCurrency, formatDatePtBr } from "../lib/format";

type FluxoProps = {
  competency: string;
  refreshKey: number;
  showValues: boolean;
  onToggleValues: () => void;
};

const emptySummary: MonthSummary = {
  competency: "",
  opening_balance: 0,
  total_in: 0,
  total_out: 0,
  closing_balance: 0,
  is_closed: 0,
};

  const todayIso = () => new Date().toISOString().slice(0, 10);

function Fluxo({ competency, refreshKey, showValues, onToggleValues }: FluxoProps) {
  const [summary, setSummary] = useState<MonthSummary>(emptySummary);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setErrorMessage("");
      setIsLoading(true);
      try {
        const [summaryData, listData] = await Promise.all([
          getMonthSummary(competency),
          listTransactions({ competency }),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryData);
        setTransactions(listData);
        setIsLoading(false);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Erro ao carregar dados."
        );
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [competency, refreshKey]);

  const titleSuffix = useMemo(
    () => (summary.is_closed ? " (Fechado)" : ""),
    [summary.is_closed]
  );

  const todayStats = useMemo(() => {
    const today = todayIso();
    const todayTransactions = transactions.filter(
      (transaction) => transaction.date === today
    );
    const totalIn = todayTransactions
      .filter((transaction) => transaction.type === "IN")
      .reduce((acc, transaction) => acc + transaction.amount, 0);
    const totalOut = todayTransactions
      .filter((transaction) => transaction.type === "OUT")
      .reduce((acc, transaction) => acc + transaction.amount, 0);
    return {
      totalIn,
      totalOut,
      variation: totalIn - totalOut,
    };
  }, [transactions]);

  const latestTransactions = useMemo(
    () => transactions.slice(0, 10),
    [transactions]
  );

  return (
    <div className="space-y-8 pt-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            Fluxo{titleSuffix}
          </h2>
          <VisibilityToggle visible={showValues} onToggle={onToggleValues} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Visão geral das movimentações do mês selecionado.
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
            {errorMessage}
          </p>
        ) : null}
      </div>
      <SummaryCards
        openingBalance={summary.opening_balance}
        totalIn={summary.total_in}
        totalOut={summary.total_out}
        closingBalance={summary.closing_balance}
        showValues={showValues}
      />
      <div className="grid gap-6 xl:grid-cols-[2fr,3fr]">
        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Hoje</h3>
            <span className="text-xs font-semibold uppercase text-slate-400">
              {formatDatePtBr(todayIso())}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Entradas
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">
                {summary.total_in === 0 && isLoading
                  ? "..."
                  : showValues
                  ? formatCurrency(todayStats.totalIn)
                  : "•••"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Saídas
              </p>
              <p className="mt-2 text-lg font-semibold text-rose-600">
                {summary.total_out === 0 && isLoading
                  ? "..."
                  : showValues
                  ? formatCurrency(todayStats.totalOut)
                  : "•••"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Variacao
              </p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  todayStats.variation >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {summary.total_in === 0 && isLoading
                  ? "..."
                  : showValues
                  ? formatCurrency(todayStats.variation)
                  : "•••"}
              </p>
            </div>
          </div>
        </section>
        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Ultimos lancamentos
            </h3>
            <span className="text-xs font-semibold uppercase text-slate-400">
              10 mais recentes
            </span>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : latestTransactions.length === 0 ? (
            <p className="text-sm text-slate-400">Sem lancamentos.</p>
          ) : (
            <div className="space-y-3">
              {latestTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDatePtBr(transaction.date)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      transaction.type === "OUT"
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {showValues
                      ? `${transaction.type === "OUT" ? "-" : "+"}${formatCurrency(
                          transaction.amount
                        )}`
                      : "•••"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Transacoes</h3>
          <span className="text-xs font-semibold uppercase text-slate-400">
            Local
          </span>
        </div>
        <TransactionTable
          transactions={transactions}
          isLoading={isLoading}
          showValues={showValues}
        />
      </section>
    </div>
  );
}

export default Fluxo;
