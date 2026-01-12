import { useEffect, useState } from "react";
import {
  parseCurrencyToCents,
  formatCurrency,
  formatCurrencyInput,
} from "../lib/format";
import VisibilityToggle from "../components/VisibilityToggle";
import {
  closeMonth,
  getMonthSettings,
  reopenMonth,
  setOpeningBalance,
  type MonthSettings,
} from "../lib/tauriApi";

type ConfigProps = {
  competency: string;
  refreshKey: number;
  showValues: boolean;
  onToggleValues: () => void;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
  onRefresh: () => void;
};

const emptySettings: MonthSettings = {
  competency: "",
  opening_balance: 0,
  is_closed: 0,
};

function Config({
  competency,
  refreshKey,
  showValues,
  onToggleValues,
  onToast,
  onRefresh,
}: ConfigProps) {
  const [settings, setSettings] = useState<MonthSettings>(emptySettings);
  const [openingBalance, setOpeningBalanceInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await getMonthSettings(competency);
        if (!active) {
          return;
        }
        setSettings(data);
        setOpeningBalanceInput(formatCurrencyInput(data.opening_balance));
        setIsLoading(false);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Erro ao carregar configuracoes."
        );
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [competency, refreshKey]);

  const handleSave = async () => {
    const cents = parseCurrencyToCents(openingBalance);
    setIsSaving(true);
    try {
      const data = await setOpeningBalance(competency, cents);
      setSettings(data);
      setOpeningBalanceInput(formatCurrencyInput(data.opening_balance));
      onToast("Saldo inicial atualizado.", "success");
      onRefresh();
    } catch (error) {
      onToast(
        error instanceof Error
          ? error.message
          : "Erro ao salvar saldo inicial.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseMonth = async () => {
    const confirmed = window.confirm(
      "Deseja fechar este mês? Isso bloqueia alterações e cria o saldo inicial do próximo mês."
    );
    if (!confirmed) {
      return;
    }

    try {
      await closeMonth(competency);
      onToast("Mes fechado com sucesso.", "success");
      onRefresh();
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao fechar mês.",
        "error"
      );
    }
  };

  const handleReopenMonth = async () => {
    const confirmed = window.confirm(
      "Deseja reabrir este mês? Isso libera edições novamente."
    );
    if (!confirmed) {
      return;
    }

    try {
      await reopenMonth(competency);
      onToast("Mes reaberto com sucesso.", "success");
      onRefresh();
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao reabrir mês.",
        "error"
      );
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">Configurações</h2>
          <VisibilityToggle visible={showValues} onToggle={onToggleValues} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Ajuste o saldo inicial e controle o fechamento do mês.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900">Saldo inicial</h3>
          <p className="mt-2 text-sm text-slate-500">
            Valor usado como base do mês selecionado.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={openingBalance}
              onChange={(event) => setOpeningBalanceInput(event.target.value)}
              placeholder="0,00"
              className="min-w-[200px] flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={settings.is_closed === 1 || isLoading}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={settings.is_closed === 1 || isSaving || isLoading}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
          {settings.is_closed === 1 ? (
            <p className="mt-3 text-xs font-semibold uppercase text-rose-400">
              Mes fechado
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900">Fechamento</h3>
          <p className="mt-2 text-sm text-slate-500">
            Ao fechar, o saldo final vira saldo inicial do próximo mês.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Saldo inicial atual:{" "}
            {showValues ? formatCurrency(settings.opening_balance) : "•••"}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCloseMonth}
              disabled={settings.is_closed === 1 || isLoading}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Fechar mês
            </button>
            <button
              type="button"
              onClick={handleReopenMonth}
              disabled={settings.is_closed === 0 || isLoading}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reabrir mês
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Config;
