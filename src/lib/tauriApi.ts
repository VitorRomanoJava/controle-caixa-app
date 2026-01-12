import { invoke } from "@tauri-apps/api/core";
import { isTauriApp } from "./tauriEnv";

const normalizeInvokeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    const inner = (error as { error?: unknown }).error;
    if (typeof inner === "string") {
      return inner;
    }
  }
  return "Erro inesperado.";
};

const safeInvoke = async <T>(
  command: string,
  payload?: Record<string, unknown>
) => {
  if (!isTauriApp()) {
    throw new Error("Tauri API indisponivel. Use `npm run tauri dev`.");
  }
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    throw new Error(normalizeInvokeError(error));
  }
};

export type TransactionType = "IN" | "OUT";

export type Transaction = {
  id: string;
  type: TransactionType;
  date: string;
  competency: string;
  description: string;
  amount: number;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionPayload = {
  type: TransactionType;
  date: string;
  competency: string;
  description: string;
  amount: number;
  category?: string | null;
  payment_method?: string | null;
  notes?: string | null;
};

export type MonthSummary = {
  competency: string;
  opening_balance: number;
  total_in: number;
  total_out: number;
  closing_balance: number;
  is_closed: number;
  by_category_in: CategoryTotal[];
  by_category_out: CategoryTotal[];
};

export type CategoryTotal = {
  category: string;
  total: number;
};

export type MonthGoals = {
  goal_in?: number | null;
  goal_out?: number | null;
  goal_balance?: number | null;
};

export type ExtraGoal = {
  id: string;
  competency: string;
  title: string;
  kind: "general" | "in" | "out";
  notes?: string | null;
  done: number;
  created_at: number;
  updated_at: number;
};

export type NotificationItem = {
  id: string;
  created_at: number;
  competency: string | null;
  kind: string;
  severity: "info" | "success" | "warn" | "danger";
  title: string;
  message: string;
  read: number;
  dedupe_key: string;
  action_target?: string | null;
};

export type MonthTotals = {
  total_in: number;
  total_out: number;
  saldo: number;
};

export type MonthSettings = {
  competency: string;
  opening_balance: number;
  is_closed: number;
};

export const listMonths = () => safeInvoke<string[]>("list_months");

export const getMonthSummary = (competency: string) =>
  safeInvoke<MonthSummary>("get_month_summary", { competency });

export const listTransactions = (params: {
  competency: string;
  type?: TransactionType;
  search?: string;
  fromDate?: string;
  toDate?: string;
}) =>
  safeInvoke<Transaction[]>("list_transactions", {
    competency: params.competency,
    type: params.type,
    search: params.search,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });

export const createTransaction = (payload: TransactionPayload) =>
  safeInvoke<Transaction>("create_transaction", { payload });

export const updateTransaction = (id: string, payload: TransactionPayload) =>
  safeInvoke<Transaction>("update_transaction", { id, payload });

export const deleteTransaction = (id: string) =>
  safeInvoke<void>("delete_transaction", { id });

export const getMonthSettings = (competency: string) =>
  safeInvoke<MonthSettings>("get_month_settings", { competency });

export const setOpeningBalance = (competency: string, openingBalance: number) =>
  safeInvoke<MonthSettings>("set_opening_balance", {
    competency,
    openingBalance,
  });

export const closeMonth = (competency: string) =>
  safeInvoke<MonthSummary>("close_month", { competency });

export const reopenMonth = (competency: string) =>
  safeInvoke<MonthSettings>("reopen_month", { competency });

export const getGoalsForMonth = (competency: string) =>
  safeInvoke<MonthGoals>("get_goals_for_month", { competency });

export const upsertGoal = (payload: {
  competency: string;
  goal_type: "in" | "out" | "balance";
  target_cents: number;
}) =>
  safeInvoke<void>("upsert_goal", {
    competency: payload.competency,
    goalType: payload.goal_type,
    targetCents: payload.target_cents,
  });

export const deleteGoal = (payload: {
  competency: string;
  goal_type: "in" | "out" | "balance";
}) =>
  safeInvoke<void>("delete_goal", {
    competency: payload.competency,
    goalType: payload.goal_type,
  });

export const deleteGoalsForMonth = (competency: string) =>
  safeInvoke<void>("delete_goals_for_month", { competency });

export const runNotificationsCheck = (competency: string) =>
  safeInvoke<NotificationItem[]>("run_notifications_check", { competency });

export const getSetting = (key: string) =>
  safeInvoke<string | null>("get_setting", { key });

export const setSetting = (key: string, value: string) =>
  safeInvoke<void>("set_setting", { key, value });

export const listNotifications = (params?: {
  onlyUnread?: boolean;
  limit?: number;
}) =>
  safeInvoke<NotificationItem[]>("list_notifications", {
    onlyUnread: params?.onlyUnread ?? null,
    limit: params?.limit ?? null,
  });

export const markNotificationRead = (id: string) =>
  safeInvoke<void>("mark_notification_read", { id });

export const markAllRead = () => safeInvoke<void>("mark_all_read");

export const clearNotifications = () => safeInvoke<void>("clear_notifications");

export const deleteNotification = (id: string) =>
  safeInvoke<void>("delete_notification", { id });

export const getUnreadCount = () =>
  safeInvoke<number>("get_unread_count");

export const getMonthTotals = (competency: string) =>
  safeInvoke<MonthTotals>("get_month_totals", { competency });

export const listExtraGoals = (competency: string) =>
  safeInvoke<ExtraGoal[]>("list_extra_goals", { competency });

export const createExtraGoal = (payload: {
  competency: string;
  title: string;
  kind: "general" | "in" | "out";
  notes?: string | null;
  done?: number;
}) =>
  safeInvoke<ExtraGoal>("create_extra_goal", {
    payload,
  });

export const updateExtraGoal = (payload: {
  id: string;
  competency: string;
  title: string;
  kind: "general" | "in" | "out";
  notes?: string | null;
  done?: number;
}) =>
  safeInvoke<ExtraGoal>("update_extra_goal", {
    payload,
  });

export const deleteExtraGoal = (id: string) =>
  safeInvoke<void>("delete_extra_goal", { id });

export const toggleExtraGoalDone = (id: string, done: number) =>
  safeInvoke<ExtraGoal>("toggle_extra_goal_done", { id, done });
