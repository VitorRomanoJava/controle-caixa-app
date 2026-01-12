import { HashRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import TransactionModal from "./components/TransactionModal";
import ToastStack, { type Toast } from "./components/ToastStack";
import Fluxo from "./pages/Fluxo";
import Entradas from "./pages/Entradas";
import Saidas from "./pages/Saidas";
import Relatorios from "./pages/Relatorios";
import Config from "./pages/Config";
import Metas from "./pages/Metas";
import Notificacoes from "./pages/Notificacoes";
import Perfil from "./pages/Perfil";
import { getUnreadCount, runNotificationsCheck, type Transaction } from "./lib/tauriApi";
import { isTauriApp } from "./lib/tauriEnv";

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

function App() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [modalState, setModalState] = useState<{
    open: boolean;
    type: "IN" | "OUT";
    transaction: Transaction | null;
  }>({ open: false, type: "IN", transaction: null });
  const [showValues, setShowValues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addToast = (message: string, variant?: Toast["variant"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const handleSaved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const refreshUnreadCount = async () => {
    if (!isTauriApp()) {
      return;
    }
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }
    const boot = async () => {
      try {
        await runNotificationsCheck(selectedMonth);
      } catch {
        // ignore
      } finally {
        refreshUnreadCount();
      }
    };
    boot();
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <Sidebar unreadCount={unreadCount} />
          <div className="flex-1">
            <Topbar
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              onAddEntrada={() =>
                setModalState({
                  open: true,
                  type: "IN",
                  transaction: null,
                })
              }
              onAddSaida={() =>
                setModalState({
                  open: true,
                  type: "OUT",
                  transaction: null,
                })
              }
            />
            <main className="px-8 pb-10">
              <Routes>
                <Route
                  path="/"
                  element={
                    <Fluxo
                      competency={selectedMonth}
                      refreshKey={refreshKey}
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                    />
                  }
                />
                <Route
                  path="/entradas"
                  element={
                    <Entradas
                      competency={selectedMonth}
                      refreshKey={refreshKey}
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      onEdit={(transaction) =>
                        setModalState({
                          open: true,
                          type: transaction.type,
                          transaction,
                        })
                      }
                      onToast={addToast}
                      onRefresh={handleSaved}
                      onNotificationsUpdated={refreshUnreadCount}
                    />
                  }
                />
                <Route
                  path="/saidas"
                  element={
                    <Saidas
                      competency={selectedMonth}
                      refreshKey={refreshKey}
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      onEdit={(transaction) =>
                        setModalState({
                          open: true,
                          type: transaction.type,
                          transaction,
                        })
                      }
                      onToast={addToast}
                      onRefresh={handleSaved}
                      onNotificationsUpdated={refreshUnreadCount}
                    />
                  }
                />
                <Route
                  path="/relatorios"
                  element={
                    <Relatorios
                      competency={selectedMonth}
                      refreshKey={refreshKey}
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      onToast={addToast}
                    />
                  }
                />
                <Route
                  path="/metas"
                  element={
                    <Metas
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      competency={selectedMonth}
                      onCompetencyChange={setSelectedMonth}
                      onToast={addToast}
                      onNotificationsUpdated={refreshUnreadCount}
                    />
                  }
                />
                <Route
                  path="/perfil"
                  element={<Perfil />}
                />
                <Route
                  path="/notificacoes"
                  element={
                    <Notificacoes
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      onNotificationsUpdated={refreshUnreadCount}
                    />
                  }
                />
                <Route
                  path="/config"
                  element={
                    <Config
                      competency={selectedMonth}
                      refreshKey={refreshKey}
                      showValues={showValues}
                      onToggleValues={() => setShowValues((prev) => !prev)}
                      onToast={addToast}
                      onRefresh={handleSaved}
                    />
                  }
                />
              </Routes>
            </main>
          </div>
        </div>
        <TransactionModal
          open={modalState.open}
          type={modalState.type}
          competency={selectedMonth}
          transaction={modalState.transaction}
          onClose={() => setModalState((state) => ({ ...state, open: false }))}
          onSaved={handleSaved}
          onNotificationsUpdated={refreshUnreadCount}
          onToast={addToast}
        />
        <ToastStack toasts={toasts} />
      </div>
    </HashRouter>
  );
}

export default App;
