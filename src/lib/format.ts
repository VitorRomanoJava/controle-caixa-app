export const formatCurrency = (amountInCents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);

export const formatCurrencyInput = (amountInCents: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);

export const parseCurrencyToCents = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma !== -1 || lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = cleaned
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".")
      .replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.round(parsed * 100);
  }

  const digits = cleaned.replace(/[^\d-]/g, "");
  if (!digits) {
    return 0;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? 0 : parsed * 100;
};

export const formatDatePtBr = (isoDate: string) => {
  if (!isoDate) {
    return "-";
  }
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}/${month}/${year}`;
};

export const formatCompetencyPtBr = (competency: string) => {
  if (!competency) {
    return "-";
  }
  const [year, month] = competency.split("-");
  if (!year || !month) {
    return competency;
  }
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return competency;
  }
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};
