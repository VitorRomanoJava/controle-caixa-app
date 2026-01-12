import { formatCurrency } from "../lib/format";

type SummaryCardsProps = {
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  showValues: boolean;
};

const icons = {
  inicial:(
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 32 32"
  className="h-5 w-5 text-white"
  aria-hidden="true"
>
  <path
    fill="currentColor"
    d="M30.47 4.575H32v16.76h-1.53ZM0 27.425h32v1.53H0Zm0-3.04h32v1.52H0Zm1.52-3.05h28.95v1.52H1.52Zm25.91-3.05h1.52v1.52h-1.52Zm0-12.19h1.52v1.52h-1.52Zm-1.53 4.57h1.53v4.57H25.9v1.53h3.05v-7.62H25.9zm-1.52 7.62h-4.57v1.52h6.09v-3.04h-1.52zm0-6.1h1.52v1.53h-1.52Zm-4.57-6.09v1.52h4.57v1.53h1.52v-3.05zm3.04 7.62h1.53v1.52h-1.53Zm0-3.05h1.53v1.52h-1.53Zm-1.52 1.52h1.52v1.53h-1.52Zm-3.05 1.53h1.53v3.05h-1.53Zm0-4.57h1.53v1.52h-1.53Zm-1.52 4.57h1.52v-1.53h-1.52v-3.04h1.52v-1.53h-1.52v-1.52h-1.52v1.52h-1.53v1.53h1.53v3.04h-1.53v1.53h1.53v3.05h-1.53v1.52h1.53v1.52h1.52v-1.52h1.52v-1.52h-1.52zm-4.57 1.52h1.52v1.53h-1.52Zm0-6.09h1.52v3.04h-1.52Zm-4.57 9.14v-1.52H6.09v3.04h6.1v-1.52zm1.52-6.1h1.52v1.53H9.14Zm-1.52 1.53h1.52v1.52H7.62Zm0-3.05h1.52v1.52H7.62Zm-1.53 1.52h1.53v1.53H6.09Zm1.53-4.57h4.57v-1.52h-6.1v3.05h1.53zm-3.05 7.62v-4.57h1.52v-1.52H3.04v7.62h3.05v-1.53zm-1.53 3.05h1.53v1.52H3.04Zm0-12.19h1.53v1.52H3.04Zm-1.52-3.05h28.95v1.53H1.52ZM0 4.575h1.52v16.76H0Z"
  />
</svg>

  ),

  entrada: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className="h-5 w-5 text-white"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M30.48 21.34h-1.52v1.52h1.52v1.52H32v-4.57h-1.52zm-1.52 3.04h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm-6.1 4.57h6.1v1.52h-6.1Zm0-6.1h6.1v1.53h-6.1Zm0 9.15h6.1v1.52h-6.1Zm-1.52-7.62h1.52v1.52h-1.52Zm-1.53 4.57h-1.52v1.52h1.52v1.53h-1.52v1.52h1.52v1.52h1.53v-7.61h-1.53zm-1.52 6.09h1.52v1.53h-1.52Zm0-9.14h1.52v1.53h-1.52Zm-7.62 10.67h7.62V32h-7.62Zm0-3.05h7.62v1.52h-7.62Zm0-3.05h7.62v1.53h-7.62Zm0-6.09h7.62v1.52h-7.62Zm0-3.05v1.52h3.05v-3.04h-1.53v1.52zm0-3.05h1.52v1.53h-1.52ZM9.15 28.95h1.52v1.53H9.15Z"
      />
      <path
        fill="currentColor"
        d="M10.67 27.43v-1.52H9.15v-1.53h1.52v-1.52H9.15v-1.52H7.62v7.61h1.53v-1.52zm-1.52-7.62h1.52v1.53H9.15Zm-6.1-3.05h7.62v1.53H3.05Zm25.91-7.62V0h-9.15v1.53h1.53v1.52h1.52v1.52h-1.52V6.1h-3.05V4.57h-1.52V3.05h-1.53V1.53h-3.05v1.52h-1.52v1.52H9.15V6.1H7.62v1.52H6.1v1.52h3.05V7.62h1.52V6.1h1.52V4.57h3.05V6.1h1.53v1.52h1.52v1.52h3.05V7.62h1.52V6.1h3.05v1.52h1.52v1.52zM3.05 10.67h7.62v1.52H3.05Zm0 16.76H6.1v1.52H3.05Zm0-4.57H6.1v1.52H3.05Zm0-3.05H6.1v1.53H3.05Zm-1.52 6.1h1.52v1.52H1.53Zm0-13.72h1.52v1.53H1.53Z"
      />
      <path
        fill="currentColor"
        d="M1.53 16.76h1.52v-1.52H1.53v-1.52H0v12.19h1.53v-3.05h1.52v-1.52H1.53v-1.53h1.52v-1.52H1.53z"
      />
    </svg>
  ),
  saida: (
    <svg viewBox="0 0 32 32" className="h-5 w-5 text-white" aria-hidden="true">
      <path
        fill="currentColor"
        d="M30.48 21.34h-1.52v1.52h1.52v1.52H32v-4.57h-1.52zm-1.52 3.04h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm-6.1 4.57h6.1v1.52h-6.1Zm0-6.1h6.1v1.53h-6.1Zm0 9.15h6.1v1.52h-6.1Zm-1.52-7.62h1.52v1.52h-1.52Zm-1.53 4.57h-1.52v1.52h1.52v1.53h-1.52v1.52h1.52v1.52h1.53v-7.61h-1.53zm-1.52 6.09h1.52v1.53h-1.52Zm0-9.14h1.52v1.53h-1.52Zm-7.62 10.67h7.62V32h-7.62Zm0-3.05h7.62v1.52h-7.62Zm0-3.05h7.62v1.53h-7.62Zm0-6.09h7.62v1.52h-7.62Zm0-3.05v1.52h3.05v-3.04h-1.53v1.52zm0-3.05h1.52v1.53h-1.52ZM9.15 28.95h1.52v1.53H9.15Z"
      />
      <path
        fill="currentColor"
        d="M10.67 27.43v-1.52H9.15v-1.53h1.52v-1.52H9.15v-1.52H7.62v7.61h1.53v-1.52zm-1.52-7.62h1.52v1.53H9.15Zm-6.1-3.05h7.62v1.53H3.05Zm0 3.05h4.57v1.53H3.05Zm0-9.14h7.62v1.52H3.05Zm18.29-1.53v1.53h-1.53v1.52h9.15V3.05h-1.53v1.52h-1.52V6.1h-3.05V4.57h-1.52V3.05h-1.53V1.53h-3.04v1.52h-1.53v1.52h-1.52V6.1h-3.05V4.57H9.15V3.05H7.62V1.53H6.1V0H3.05v1.53h1.53v1.52H6.1v1.52h1.52V6.1h1.53v1.52h1.52v1.52h3.05V7.62h1.52V6.1h1.53V4.57h3.04V6.1h1.53v1.52h1.52v1.52zM3.05 25.91H6.1v1.52H3.05Zm0-3.05H6.1v1.52H3.05ZM1.53 12.19h1.52v1.53H1.53Zm0 7.62h1.52v-1.52H1.53v-1.53h1.52v-1.52H1.53v-1.52H0v12.19h3.05v-1.53H1.53v-1.52h1.52v-1.52H1.53z"
      />
    </svg>
  ),
  final:(
    <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 32 32"
  className="h-5 w-5 text-white"
  aria-hidden="true"
>
  <path
    fill="currentColor"
    d="M30.47 6.1H32v1.52h-1.53Zm-1.52 9.14v1.52h-1.52v1.53h1.52v1.52h-1.52v1.52h1.52v1.53h-1.52v1.52h3.04V12.19h-1.52v1.52h-1.52v1.53zM25.9 4.57h4.57V6.1H25.9Zm0 3.05v1.52h1.53v1.53h1.52V9.14h1.52V7.62zm4.57-4.57V1.52h-1.52V0h-1.52v1.52H25.9v1.53zm-6.09 9.14h3.05v1.52h-3.05Z"
  />
  <path
    fill="currentColor"
    d="M10.66 15.24h3.05v1.52h1.53v1.53h3.04v1.52h-3.04v1.52h3.04v1.53h-3.04v1.52h3.04v1.53h-3.04v1.52h3.04v1.52h3.05v-1.52h3.05v-1.52h3.05v-1.53h-3.05v-1.52h3.05v-1.53h-3.05v-1.52h3.05v-1.52h-3.05v-1.53h3.05v-1.52h-3.05v-1.53h-3.05v-1.52h-3.05v-1.52h-3.04V9.14h-3.05v1.53H9.14v1.52H6.09v1.52h4.57zM24.38 3.05h1.52v1.52h-1.52Zm-3.05 4.57h3.05v1.52h-3.05ZM18.28 6.1h3.05v1.52h-3.05Zm-3.04 1.52h3.04v1.52h-3.04Z"
  />
  <path
    fill="currentColor"
    d="M15.24 28.95h3.04v1.53h-3.04ZM13.71 4.57h1.53V6.1h-1.53Z"
  />
  <path
    fill="currentColor"
    d="M13.71 28.95h1.53v-1.52h-1.53v-1.52h1.53v-1.53h-1.53v-1.52h1.53v-1.53h-1.53v-1.52h1.53v-1.52h-3.05v1.52H9.14v1.52h3.05v1.53H9.14v1.52h3.05v1.53H9.14v1.52h3.05v1.52H9.14v1.53h3.05V32h3.05v-1.52h-1.53zM10.66 0h3.05v1.52h-3.05Zm0 6.1h3.05v1.52h-3.05Zm0-3.05h3.05v1.52h-3.05ZM9.14 1.52h1.52v1.53H9.14ZM6.09 27.43h3.05v1.52H6.09Zm0-9.14h3.05v1.52H6.09Zm0 6.09h3.05v1.53H6.09Zm0-3.05h3.05v1.53H6.09Zm0-15.23h1.53v1.52H6.09ZM3.04 25.91h3.05v1.52H3.04Zm0-3.05h3.05v1.52H3.04Zm0-3.05h3.05v1.52H3.04Zm0-3.05h3.05v1.53H3.04Zm0-3.05h3.05v1.53H3.04ZM1.52 7.62v1.52h1.52v1.53h1.53V9.14h1.52V7.62zm4.57-4.57V1.52H4.57V0H3.04v1.52H1.52v1.53zM3.04 24.38H1.52v-1.52h1.52v-1.53H1.52v-1.52h1.52v-1.52H1.52v-1.53h1.52v-1.52H0v10.67h3.04zM1.52 4.57h4.57V6.1H1.52ZM0 3.05h1.52v1.52H0Z"
  />
</svg>

  ),

} as const;

type IconKey = keyof typeof icons;

function SummaryCards({
  openingBalance,
  totalIn,
  totalOut,
  closingBalance,
  showValues,
}: SummaryCardsProps) {
  const cards: {
    title: string;
    value: number;
    accent: string;
    accentNegative?: string;
    iconKey?: IconKey;
  }[] = [
    {
      title: "Saldo inicial",
      value: openingBalance,
      accent: "bg-slate-900",
      iconKey: "inicial",
    },
    {
      title: "Entradas",
      value: totalIn,
      accent: "bg-emerald-600",
      iconKey: "entrada",
    },
    {
      title: "Saídas",
      value: totalOut,
      accent: "bg-rose-600",
      iconKey: "saida",
    },
    {
      title: "Saldo final",
      value: closingBalance,
      accent: "bg-indigo-600",
      accentNegative: "bg-rose-600",
      iconKey: "final",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {showValues ? formatCurrency(card.value) : "•••"}
              </p>
            </div>

            <div
              className={`${
                card.accentNegative && card.value < 0
                  ? card.accentNegative
                  : card.accent
              } h-10 w-10 rounded-2xl flex items-center justify-center`}
            >
              {card.iconKey ? icons[card.iconKey] : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SummaryCards;
