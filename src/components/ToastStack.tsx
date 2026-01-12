type Toast = {
  id: string;
  message: string;
  variant?: "success" | "error" | "info";
};

type ToastStackProps = {
  toasts: Toast[];
};

const variantStyles: Record<NonNullable<Toast["variant"]>, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-slate-200 bg-white text-slate-700",
};

function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-[60] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 text-sm shadow-soft ${
            variantStyles[toast.variant ?? "info"]
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export type { Toast };
export default ToastStack;
