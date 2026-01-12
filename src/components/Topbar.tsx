import MonthPicker from "./MonthPicker";

type TopbarProps = {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onAddEntrada: () => void;
  onAddSaida: () => void;
};

function Topbar({
  selectedMonth,
  onMonthChange,
  onAddEntrada,
  onAddSaida,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-8 py-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthPicker value={selectedMonth} onChange={onMonthChange} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAddEntrada}
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-emerald-700"
          >
            + Entrada
          </button>
          <button
            type="button"
            onClick={onAddSaida}
            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-rose-700"
          >
            + Saída
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
