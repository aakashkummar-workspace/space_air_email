export interface CurrencyMeta {
  code: string;
  symbol: string;
  label: string;
  locale: string;
  // Indian numbering (Cr/Lakh) only makes sense for INR; everything else
  // uses K/M/B compact notation.
  useIndianUnits: boolean;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN", useIndianUnits: true },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", useIndianUnits: false },
  { code: "EUR", symbol: "€", label: "Euro", locale: "en-IE", useIndianUnits: false },
  { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB", useIndianUnits: false },
  { code: "AED", symbol: "AED ", label: "UAE Dirham", locale: "en-AE", useIndianUnits: false },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", locale: "en-SG", useIndianUnits: false },
  { code: "LKR", symbol: "Rs ", label: "Sri Lankan Rupee", locale: "en-LK", useIndianUnits: false },
];

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatMoney(n: number, currencyCode: string = "INR"): string {
  const meta = currencyMeta(currencyCode);
  return meta.symbol + n.toLocaleString(meta.locale, { maximumFractionDigits: 0 });
}

export function formatCompactMoney(n: number, currencyCode: string = "INR"): string {
  const meta = currencyMeta(currencyCode);
  const abs = Math.abs(n);

  if (meta.useIndianUnits) {
    if (abs >= 1e7) return meta.symbol + (n / 1e7).toFixed(2) + " Cr";
    if (abs >= 1e5) return meta.symbol + (n / 1e5).toFixed(2) + " L";
    return formatMoney(n, currencyCode);
  }

  if (abs >= 1e9) return meta.symbol + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return meta.symbol + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return meta.symbol + (n / 1e3).toFixed(1) + "K";
  return formatMoney(n, currencyCode);
}
