import { formatCompetencyPtBr } from "../lib/format";

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

const buildMonthOptions = (count = 12) => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const value = `${year}-${month}`;
    const label =
      i === 0 ? `Mes atual (${formatCompetencyPtBr(value)})` : formatCompetencyPtBr(value);

    options.push({ value, label });
  }

  return options;
};

const monthOptions = buildMonthOptions();

function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-slate-600">
        Mes de referencia
      </span>
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-transparent text-sm font-medium text-slate-700 outline-none"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default MonthPicker;
