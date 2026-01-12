type VisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

function VisibilityToggle({ visible, onToggle }: VisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-soft transition hover:bg-slate-50"
    >
      {visible ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 6h8v2H8zm-4 4V8h4v2zm-2 2v-2h2v2zm0 2v-2H0v2zm2 2H2v-2h2zm4 2H4v-2h4zm8 0v2H8v-2zm4-2v2h-4v-2zm2-2v2h-2v-2zm0-2h2v2h-2zm-2-2h2v2h-2zm0 0V8h-4v2zm-10 1h4v4h-4z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            fill="currentColor"
            d="M0 7h2v2H0zm4 4H2V9h2zm4 2v-2H4v2H2v2h2v-2zm8 0H8v2H6v2h2v-2h8v2h2v-2h-2zm4-2h-4v2h4v2h2v-2h-2zm2-2v2h-2V9zm0 0V7h2v2z"
          />
        </svg>
      )}
      <span>{visible ? "Esconder valores" : "Exibir valores"}</span>
    </button>
  );
}

export default VisibilityToggle;
