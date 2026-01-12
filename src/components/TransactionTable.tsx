import { formatCurrency, formatDatePtBr } from "../lib/format";
import type { Transaction } from "../lib/tauriApi";

const columns = [
  "Data",
  "Descrição",
  "Categoria",
  "Forma",
  "Valor",
  "Acoes",
];

type TransactionTableProps = {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  isLoading?: boolean;
  showValues?: boolean;
};

function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  isLoading = false,
  showValues = true,
}: TransactionTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-5 py-4 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr className="border-t border-slate-100">
              <td
                colSpan={columns.length}
                className="px-5 py-10 text-center text-sm text-slate-400"
              >
                Carregando transacoes...
              </td>
            </tr>
          ) : transactions.length === 0 ? (
            <tr className="border-t border-slate-100">
              <td
                colSpan={columns.length}
                className="px-5 py-10 text-center text-sm text-slate-400"
              >
                Nenhuma transação cadastrada para este mês.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => {
              const isOut = transaction.type === "OUT";
              const sign = isOut ? "-" : "";
              return (
                <tr key={transaction.id} className="border-t border-slate-100">
                  <td className="px-5 py-4 text-slate-700">
                    {formatDatePtBr(transaction.date)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {transaction.description}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {transaction.category ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {transaction.payment_method ?? "-"}
                  </td>
                  <td
                    className={`px-5 py-4 font-semibold ${
                      isOut ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {showValues ? `${sign}${formatCurrency(transaction.amount)}` : "•••"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(transaction)}
                          className="text-slate-600 transition hover:text-slate-900"
                        >
                          Editar
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                      {onDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(transaction)}
                          className="text-rose-500 transition hover:text-rose-600"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionTable;
