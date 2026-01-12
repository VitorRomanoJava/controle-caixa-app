import { useEffect, useMemo, useState } from "react";
import VisibilityToggle from "../components/VisibilityToggle";
import {
  createExtraGoal,
  deleteExtraGoal,
  deleteGoal,
  deleteGoalsForMonth,
  getGoalsForMonth,
  listExtraGoals,
  runNotificationsCheck,
  toggleExtraGoalDone,
  updateExtraGoal,
  upsertGoal,
  type ExtraGoal,
  type MonthGoals,
} from "../lib/tauriApi";
import {
  formatCompetencyPtBr,
  formatCurrencyInput,
  parseCurrencyToCents,
} from "../lib/format";
import { isTauriApp } from "../lib/tauriEnv";
type ExtraGoalKind = "general" | "in" | "out";

const extraGoalKindLabels: Record<ExtraGoalKind, string> = {
  general: "Geral",
  in: "Entrada",
  out: "Saída",
};

type ExtraGoalForm = {
  id: string | null;
  competency: string;
  title: string;
  kind: ExtraGoalKind;
  notes: string;
  done: boolean;
};

type MetasProps = {
  showValues: boolean;
  onToggleValues: () => void;
  competency: string;
  onCompetencyChange: (value: string) => void;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
  onNotificationsUpdated?: () => void;
};

const buildMonthOptions = (base: string, range = 24) => {
  const [yearRaw, monthRaw] = base.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) {
    return [];
  }
  const options: string[] = [];
  for (let i = -range; i <= range; i += 1) {
    const date = new Date(year, month - 1 + i, 1);
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push(label);
  }
  return options;
};

const shiftMonth = (competency: string, delta: number) => {
  const [yearRaw, monthRaw] = competency.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) {
    return competency;
  }
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

function Metas({
  showValues,
  onToggleValues,
  competency,
  onCompetencyChange,
  onToast,
  onNotificationsUpdated,
}: MetasProps) {
  const [financialGoals, setFinancialGoals] = useState<MonthGoals>({
    goal_in: null,
    goal_out: null,
    goal_balance: null,
  });
  const [financialValues, setFinancialValues] = useState({
    in: "",
    out: "",
    balance: "",
  });
  const [extraGoals, setExtraGoals] = useState<ExtraGoal[]>([]);
  const [extraFormOpen, setExtraFormOpen] = useState(false);
  const [extraForm, setExtraForm] = useState<ExtraGoalForm>({
    id: null,
    competency,
    title: "",
    kind: "general",
    notes: "",
    done: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingExtra, setIsSavingExtra] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);

  const loadData = async (current: string) => {
    setIsLoading(true);
    try {
      const [goalsData, extrasData] = await Promise.all([
        getGoalsForMonth(current),
        listExtraGoals(current),
      ]);
      setFinancialGoals(goalsData);
      setFinancialValues({
        in: goalsData.goal_in ? formatCurrencyInput(goalsData.goal_in) : "",
        out: goalsData.goal_out ? formatCurrencyInput(goalsData.goal_out) : "",
        balance: goalsData.goal_balance
          ? formatCurrencyInput(goalsData.goal_balance)
          : "",
      });
      setIsEditingGoals(false);
      setExtraGoals(extrasData);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao carregar metas.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(competency);
  }, [competency]);

  const handleSaveGoals = async () => {
    try {
      setIsSavingGoals(true);
      const inCents = parseCurrencyToCents(financialValues.in);
      const outCents = parseCurrencyToCents(financialValues.out);
      const balanceCents = parseCurrencyToCents(financialValues.balance);

      const tasks: Promise<unknown>[] = [];
      if (inCents > 0) {
        tasks.push(
          upsertGoal({ competency, goal_type: "in", target_cents: inCents })
        );
      } else {
        tasks.push(deleteGoal({ competency, goal_type: "in" }));
      }

      if (outCents > 0) {
        tasks.push(
          upsertGoal({ competency, goal_type: "out", target_cents: outCents })
        );
      } else {
        tasks.push(deleteGoal({ competency, goal_type: "out" }));
      }

      if (balanceCents > 0) {
        tasks.push(
          upsertGoal({
            competency,
            goal_type: "balance",
            target_cents: balanceCents,
          })
        );
      } else {
        tasks.push(deleteGoal({ competency, goal_type: "balance" }));
      }

      await Promise.all(tasks);
      if (isTauriApp()) {
        await runNotificationsCheck(competency);
        onNotificationsUpdated?.();
      }
      const updated = await getGoalsForMonth(competency);
      setFinancialGoals(updated);
      setFinancialValues({
        in: updated.goal_in ? formatCurrencyInput(updated.goal_in) : "",
        out: updated.goal_out ? formatCurrencyInput(updated.goal_out) : "",
        balance: updated.goal_balance ? formatCurrencyInput(updated.goal_balance) : "",
      });
      onToast("Metas financeiras salvas.", "success");
      setIsEditingGoals(false);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao salvar metas.",
        "error"
      );
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleClearGoals = async () => {
    try {
      setIsSavingGoals(true);
      await deleteGoalsForMonth(competency);
      setFinancialGoals({ goal_in: null, goal_out: null, goal_balance: null });
      setFinancialValues({ in: "", out: "", balance: "" });
      if (isTauriApp()) {
        await runNotificationsCheck(competency);
        onNotificationsUpdated?.();
      }
      onToast("Metas financeiras removidas.", "success");
      setIsEditingGoals(false);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao limpar metas.",
        "error"
      );
    } finally {
      setIsSavingGoals(false);
    }
  };
  const monthOptions = useMemo(() => buildMonthOptions(competency), [competency]);

  const resetExtraForm = (current: string) => {
    setExtraForm({
      id: null,
      competency: current,
      title: "",
      kind: "general",
      notes: "",
      done: false,
    });
  };

  const handleExtraSave = async () => {
    if (!extraForm.title.trim()) {
      onToast("Informe o titulo da meta extra.", "error");
      return;
    }
    try {
      setIsSavingExtra(true);
      if (extraForm.id) {
        await updateExtraGoal({
          id: extraForm.id,
          competency: extraForm.competency,
          title: extraForm.title.trim(),
          kind: extraForm.kind,
          notes: extraForm.notes.trim() || null,
          done: extraForm.done ? 1 : 0,
        });
        onToast("Meta extra atualizada.", "success");
      } else {
        await createExtraGoal({
          competency: extraForm.competency,
          title: extraForm.title.trim(),
          kind: extraForm.kind,
          notes: extraForm.notes.trim() || null,
          done: extraForm.done ? 1 : 0,
        });
        onToast("Meta extra criada.", "success");
      }
      const updated = await listExtraGoals(competency);
      setExtraGoals(updated);
      resetExtraForm(competency);
      setExtraFormOpen(false);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao salvar meta extra.",
        "error"
      );
    } finally {
      setIsSavingExtra(false);
    }
  };

  const handleExtraEdit = (goalItem: ExtraGoal) => {
    setExtraForm({
      id: goalItem.id,
      competency: goalItem.competency,
      title: goalItem.title,
      kind: goalItem.kind,
      notes: goalItem.notes ?? "",
      done: goalItem.done === 1,
    });
    setExtraFormOpen(true);
  };

  const handleExtraDelete = async (id: string) => {
    if (!window.confirm("Deseja remover esta meta extra?")) {
      return;
    }
    try {
      await deleteExtraGoal(id);
      setExtraGoals((prev) => prev.filter((item) => item.id !== id));
      onToast("Meta extra removida.", "success");
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao remover meta extra.",
        "error"
      );
    }
  };

  const handleExtraToggle = async (goalItem: ExtraGoal) => {
    try {
      const updated = await toggleExtraGoalDone(goalItem.id, goalItem.done === 1 ? 0 : 1);
      setExtraGoals((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao atualizar meta extra.",
        "error"
      );
    }
  };

  const hasFinancialGoals = useMemo(
    () =>
      Boolean(
        financialGoals.goal_in ||
          financialGoals.goal_out ||
          financialGoals.goal_balance
      ),
    [financialGoals]
  );

  useEffect(() => {
    setExtraFormOpen(false);
    resetExtraForm(competency);
    setIsEditingGoals(false);
  }, [competency]);

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Metas</h2>
          <p className="mt-2 text-sm text-slate-500">
            Defina metas financeiras e objetivos extras do mês.
          </p>
        </div>
        <VisibilityToggle visible={showValues} onToggle={onToggleValues} />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onCompetencyChange(shiftMonth(competency, -1))}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft transition hover:bg-slate-50"
          >
            Anterior
          </button>
          <select
            value={competency}
            onChange={(event) => onCompetencyChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatCompetencyPtBr(month)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onCompetencyChange(shiftMonth(competency, 1))}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft transition hover:bg-slate-50"
          >
            Próximo
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Metas financeiras
            </h3>
            <p className="mt-2 text-sm text-slate-500">
            Defina metas em R$ para este mês.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <label className="grid gap-2 text-sm font-medium text-slate-600 md:grid-cols-[1fr,220px] md:items-center">
            Meta de entradas (R$)
            <input
              type="text"
              inputMode="decimal"
              value={financialValues.in}
              onChange={(event) =>
                setFinancialValues((prev) => ({ ...prev, in: event.target.value }))
              }
              disabled={!isEditingGoals}
              placeholder="0,00"
              className={`w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 ${
                isEditingGoals ? "" : "bg-slate-50 text-slate-500"
              }`}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-600 md:grid-cols-[1fr,220px] md:items-center">
            Limite de saídas (R$)
            <input
              type="text"
              inputMode="decimal"
              value={financialValues.out}
              onChange={(event) =>
                setFinancialValues((prev) => ({ ...prev, out: event.target.value }))
              }
              disabled={!isEditingGoals}
              placeholder="0,00"
              className={`w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 ${
                isEditingGoals ? "" : "bg-slate-50 text-slate-500"
              }`}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-600 md:grid-cols-[1fr,220px] md:items-center">
            Meta de saldo final (R$)
            <input
              type="text"
              inputMode="decimal"
              value={financialValues.balance}
              onChange={(event) =>
                setFinancialValues((prev) => ({
                  ...prev,
                  balance: event.target.value,
                }))
              }
              disabled={!isEditingGoals}
              placeholder="Opcional"
              className={`w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 ${
                isEditingGoals ? "" : "bg-slate-50 text-slate-500"
              }`}
            />
          </label>
        </div>
        {hasFinancialGoals ? (
          <p className="mt-3 text-xs text-slate-500">
            Metas definidas para {formatCompetencyPtBr(competency)}.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {isEditingGoals ? (
            <>
              <button
                type="button"
                onClick={handleSaveGoals}
                disabled={isSavingGoals}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingGoals ? "Salvando..." : "Salvar metas"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinancialValues({
                    in: financialGoals.goal_in
                      ? formatCurrencyInput(financialGoals.goal_in)
                      : "",
                    out: financialGoals.goal_out
                      ? formatCurrencyInput(financialGoals.goal_out)
                      : "",
                    balance: financialGoals.goal_balance
                      ? formatCurrencyInput(financialGoals.goal_balance)
                      : "",
                  });
                  setIsEditingGoals(false);
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearGoals}
                disabled={isSavingGoals}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                Limpar tudo
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingGoals(true)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft"
            >
              {hasFinancialGoals ? "Editar metas" : "+ Definir metas"}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Metas extras</h3>
            <p className="mt-2 text-sm text-slate-500">
              Objetivos pessoais/operacionais para este mês.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!extraFormOpen) {
                resetExtraForm(competency);
              }
              setExtraFormOpen((prev) => !prev);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-soft transition hover:bg-slate-50"
          >
            + Nova meta
          </button>
        </div>

        {extraFormOpen ? (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-600 md:col-span-2">
                Titulo
                <input
                  type="text"
                  value={extraForm.title}
                  onChange={(event) =>
                    setExtraForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder={
                    extraForm.kind === "in"
                      ? "Ex: Vender 100 unidades"
                      : "Ex: Quero comprar meu carro"
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Tipo
                <select
                  value={extraForm.kind}
                  onChange={(event) =>
                    setExtraForm((prev) => ({
                      ...prev,
                      kind: event.target.value as ExtraGoalKind,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {Object.entries(extraGoalKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                Competência
                <select
                  value={extraForm.competency}
                  onChange={(event) =>
                    setExtraForm((prev) => ({
                      ...prev,
                      competency: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatCompetencyPtBr(month)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600 md:col-span-2">
                Observação (opcional)
                <textarea
                  rows={3}
                  value={extraForm.notes}
                  onChange={(event) =>
                    setExtraForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Detalhes adicionais"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={extraForm.done}
                  onChange={(event) =>
                    setExtraForm((prev) => ({ ...prev, done: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Concluida
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExtraSave}
                disabled={isSavingExtra}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingExtra ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtraFormOpen(false);
                  resetExtraForm(competency);
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {extraGoals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
              Nenhuma meta extra para este mês ainda. Crie a primeira.
            </div>
          ) : (
            extraGoals.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleExtraToggle(item)}
                  className="mt-1 h-5 w-5 rounded border border-slate-300 bg-white text-slate-500"
                  aria-label="Marcar como concluida"
                >
                  {item.done === 1 ? "✓" : ""}
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        item.done === 1 ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                      {extraGoalKindLabels[item.kind]}
                    </span>
                    {item.competency !== competency ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                        {formatCompetencyPtBr(item.competency)}
                      </span>
                    ) : null}
                  </div>
                  {item.notes ? (
                    <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
                  ) : null}
                </div>
                <div className="flex gap-2 text-xs font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => handleExtraEdit(item)}
                    className="rounded-full border border-slate-200 px-3 py-1 transition hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExtraDelete(item.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 transition hover:bg-white"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando metas...</p>
      ) : null}
    </div>
  );
}

export default Metas;
