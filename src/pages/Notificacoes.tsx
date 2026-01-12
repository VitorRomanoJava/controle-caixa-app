import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllRead,
  markNotificationRead,
  type NotificationItem,
} from "../lib/tauriApi";

type NotificacoesProps = {
  showValues: boolean;
  onToggleValues: () => void;
  onNotificationsUpdated?: () => void;
};

const severityStyles: Record<
  NotificationItem["severity"],
  { badge: string; dot: string }
> = {
  info: { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  success: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  warn: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  danger: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

const severityLabels: Record<NotificationItem["severity"], string> = {
  info: "Info",
  success: "Sucesso",
  warn: "Alerta",
  danger: "Crítico",
};

const formatDateTime = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const actionLabelFor = (item: NotificationItem) => {
  if (item.kind === "month_start") {
    return "Definir metas";
  }
  if (item.kind === "month_end") {
    return "Ver relatório";
  }
  return "Abrir";
};

function Notificacoes({
  showValues: _showValues,
  onToggleValues: _onToggleValues,
  onNotificationsUpdated,
}: NotificacoesProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await listNotifications();
      setItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao carregar notificações."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: 1 } : item))
      );
      onNotificationsUpdated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao atualizar notificação."
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja excluir esta notificação?")) {
      return;
    }
    try {
      await deleteNotification(id);
      const nextItems = items.filter((item) => item.id !== id);
      setItems(nextItems);
      onNotificationsUpdated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao excluir notificação."
      );
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: 1 })));
      onNotificationsUpdated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao marcar notificações."
      );
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Deseja limpar todas as notificações?")) {
      return;
    }
    try {
      await clearNotifications();
      setItems([]);
      onNotificationsUpdated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao limpar notificações."
      );
    }
  };

  return (
    <div className="space-y-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Notificações
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Alertas de metas financeiras e relatórios mensais.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft"
          >
            Marcar tudo como lido
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft"
          >
            Limpar tudo
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando notificações...</p>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
          Nenhuma notificação por enquanto.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-soft ${
              item.read === 1 ? "opacity-70" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-2 h-2 w-2 rounded-full ${severityStyles[item.severity].dot}`}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityStyles[item.severity].badge}`}
                    >
                      {severityLabels[item.severity]}
                    </span>
                    {item.competency ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {item.competency}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {item.read === 0 ? (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 transition hover:bg-slate-50"
                  >
                    Marcar como lido
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                    Lida
                  </span>
                )}
                {item.action_target ? (
                  <button
                    type="button"
                    onClick={() => navigate(item.action_target)}
                    className="rounded-full border border-slate-200 px-3 py-1 transition hover:bg-slate-50"
                  >
                    {actionLabelFor(item)}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Excluir notificação"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M16 2v4h6v2h-2v14H4V8H2V6h6V2zm-2 2h-4v2h4zm0 4H6v12h12V8zm-5 2h2v8H9zm6 0h-2v8h2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notificacoes;
