import { useEffect, useMemo, useState } from "react";
import type { Transaction, TransactionPayload } from "../lib/tauriApi";
import {
  createTransaction,
  runNotificationsCheck,
  updateTransaction,
} from "../lib/tauriApi";
import { isTauriApp } from "../lib/tauriEnv";
import {
  formatCompetencyPtBr,
  formatCurrencyInput,
  parseCurrencyToCents,
} from "../lib/format";

const todayIso = () => new Date().toISOString().slice(0, 10);

const typeLabels: Record<"IN" | "OUT", string> = {
  IN: "Entrada",
  OUT: "Saída",
};

type TransactionModalProps = {
  open: boolean;
  type: "IN" | "OUT";
  competency: string;
  transaction?: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
  onNotificationsUpdated?: () => void;
  onToast: (message: string, variant?: "success" | "error" | "info") => void;
};

function TransactionModal({
  open,
  type,
  competency,
  transaction,
  onClose,
  onSaved,
  onNotificationsUpdated,
  onToast,
}: TransactionModalProps) {
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({});
  const [showCompetencyHelp, setShowCompetencyHelp] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDate(transaction?.date ?? todayIso());
    setDescription(transaction?.description ?? "");
    setCategory(transaction?.category ?? "");
    setPaymentMethod(transaction?.payment_method ?? "");
    setAmount(
      transaction ? formatCurrencyInput(transaction.amount) : ""
    );
    setNotes(transaction?.notes ?? "");
    setErrors({});
  }, [open, transaction]);

  const mode = transaction ? "edit" : "create";
  const title = useMemo(() => {
    if (mode === "edit") {
      return `Editar ${typeLabels[transaction?.type ?? type]}`;
    }
    return `Nova ${typeLabels[type]}`;
  }, [mode, transaction, type]);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    const nextErrors: { description?: string; amount?: string } = {};
    if (!description.trim()) {
      nextErrors.description = "Descrição obrigatória.";
    }

    const amountCents = parseCurrencyToCents(amount);
    if (amountCents <= 0) {
      nextErrors.amount = "Valor deve ser maior que zero.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: TransactionPayload = {
      type: transaction?.type ?? type,
      date,
      competency: transaction?.competency ?? competency,
      description: description.trim(),
      amount: amountCents,
      category: category.trim() || null,
      payment_method: paymentMethod.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      setSaving(true);
      if (mode === "edit" && transaction) {
        await updateTransaction(transaction.id, payload);
      } else {
        await createTransaction(payload);
      }
      if (isTauriApp()) {
        await runNotificationsCheck(payload.competency);
        onNotificationsUpdated?.();
      }
      onToast("Lançamento salvo com sucesso.", "success");
      onSaved();
      onClose();
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Erro ao salvar lançamento.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">
              Lançamento
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-600">
            Data
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            <span className="inline-flex items-center gap-2">
              Mês de referência
              <button
                type="button"
                onClick={() => setShowCompetencyHelp((prev) => !prev)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                aria-label="O que é mês de referência"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    fill="currentColor"
                    d="M10 18h3v3h-3zm7-13v6h-1v1h-1v1h-2v2h-3v-3h1v-1h2v-1h1V6h-4v1H9v1H7V5h1V4h1V3h6v1h1v1z"
                  />
                </svg>
              </button>
            </span>
            <input
              type="text"
              value={formatCompetencyPtBr(
                transaction?.competency ?? competency
              )}
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
            {showCompetencyHelp ? (
              <span className="mt-2 block text-xs text-slate-500">
                Este é o mês que define em qual caixa o lançamento entra, por
                exemplo: janeiro de 2026.
              </span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-slate-600 md:col-span-2">
            Descrição
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex: Venda balcao"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            {errors.description ? (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.description}
              </span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-slate-600">
            Categoria
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Categoria"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Forma
            <input
              type="text"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              placeholder="Dinheiro, Pix, Cartao"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Valor (R$)
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            {errors.amount ? (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.amount}
              </span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-slate-600 md:col-span-2">
            Observação
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalhes adicionais"
              className="mt-2 min-h-[90px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransactionModal;
