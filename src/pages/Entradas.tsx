import { useEffect, useState } from "react";
import TransactionTable from "../components/TransactionTable";
import VisibilityToggle from "../components/VisibilityToggle";
import {
  deleteTransaction,
  listTransactions,
  runNotificationsCheck,
  type Transaction,
} from "../lib/tauriApi";
import { isTauriApp } from "../lib/tauriEnv";

type EntradasProps = {
  competency: string;
  refreshKey: number;
  showValues: boolean;
  onToggleValues: () => void;
  onEdit: (transaction: Transaction) => void;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
  onRefresh: () => void;
  onNotificationsUpdated?: () => void;
};

function Entradas({
  competency,
  refreshKey,
  showValues,
  onToggleValues,
  onEdit,
  onToast,
  onRefresh,
  onNotificationsUpdated,
}: EntradasProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await listTransactions({
          competency,
          type: "IN",
          search: search.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
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
          error instanceof Error ? error.message : "Erro ao carregar entradas."
        );
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [competency, refreshKey, search, fromDate, toDate]);

  const handleDelete = async (transaction: Transaction) => {
    const confirmed = window.confirm(
      "Deseja excluir esta entrada? Essa acao nao pode ser desfeita."
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteTransaction(transaction.id);
      if (isTauriApp()) {
        await runNotificationsCheck(transaction.competency);
        onNotificationsUpdated?.();
      }
      onToast("Entrada excluída.", "success");
      onRefresh();
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao excluir entrada.",
        "error"
      );
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">Entradas</h2>
          <VisibilityToggle visible={showValues} onToggle={onToggleValues} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Busque, filtre e edite as entradas do mês selecionado.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar descrição"
          className="min-w-[220px] flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}

      <TransactionTable
        transactions={transactions}
        isLoading={isLoading}
        onEdit={onEdit}
        onDelete={handleDelete}
        showValues={showValues}
      />
    </div>
  );
}

export default Entradas;
