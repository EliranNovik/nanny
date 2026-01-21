/**
 * Currency conversion utility
 * Converts various currencies to NIS (Israeli Shekels)
 */

export interface Currency {
  id: string;
  name: string;
  iso: string;
  icon: string;
}

// Currency conversion rates to NIS (Israeli Shekels)
// These are approximate rates - in production, you should fetch real-time rates from an API
const CURRENCY_RATES_TO_NIS: Record<string, number> = {
  ILS: 1.0,      // NIS to NIS (1:1)
  USD: 3.6,      // 1 USD ≈ 3.6 NIS (approximate)
  EUR: 3.9,      // 1 EUR ≈ 3.9 NIS (approximate)
  GBP: 4.5,      // 1 GBP ≈ 4.5 NIS (approximate)
};

/**
 * Get the conversion rate from a currency ISO code to NIS
 * @param currencyIso - ISO code of the currency (e.g., "USD", "EUR", "ILS")
 * @returns Conversion rate to NIS
 */
export function getRateToNIS(currencyIso: string): number {
  const normalizedIso = currencyIso.toUpperCase();
  return CURRENCY_RATES_TO_NIS[normalizedIso] || 1.0;
}

/**
 * Convert an amount from one currency to NIS
 * @param amount - Amount to convert
 * @param fromCurrencyIso - ISO code of the source currency
 * @returns Amount in NIS
 */
export function convertToNIS(amount: number, fromCurrencyIso: string): number {
  const rate = getRateToNIS(fromCurrencyIso);
  return amount * rate;
}

/**
 * Convert an amount from NIS to another currency
 * @param amount - Amount in NIS
 * @param toCurrencyIso - ISO code of the target currency
 * @returns Amount in target currency
 */
export function convertFromNIS(amount: number, toCurrencyIso: string): number {
  const rate = getRateToNIS(toCurrencyIso);
  return amount / rate;
}

/**
 * Format currency amount with symbol
 * @param amount - Amount to format
 * @param currencyIso - ISO code of the currency
 * @param currencyIcon - Icon/symbol for the currency
 * @returns Formatted string (e.g., "$100.00 USD" or "₪360.00 NIS")
 */
export function formatCurrency(
  amount: number,
  currencyIso: string,
  currencyIcon?: string
): string {
  const icon = currencyIcon || getCurrencyIcon(currencyIso);
  const iso = currencyIso.toUpperCase();
  return `${icon}${amount.toFixed(2)} ${iso}`;
}

/**
 * Get currency icon/symbol by ISO code
 * @param currencyIso - ISO code of the currency
 * @returns Currency symbol
 */
export function getCurrencyIcon(currencyIso: string): string {
  const normalizedIso = currencyIso.toUpperCase();
  const iconMap: Record<string, string> = {
    ILS: "₪",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  return iconMap[normalizedIso] || "$";
}

/**
 * Convert and sum multiple payments to NIS
 * @param payments - Array of payments with amount and currency
 * @returns Total amount in NIS
 */
export function sumPaymentsInNIS(
  payments: Array<{ total_amount: number; currency?: Currency | null }>
): number {
  return payments.reduce((sum, payment) => {
    const currencyIso = payment.currency?.iso || "ILS";
    const amountInNIS = convertToNIS(payment.total_amount, currencyIso);
    return sum + amountInNIS;
  }, 0);
}

/**
 * Update conversion rates (for future API integration)
 * @param rates - Object mapping currency ISO codes to NIS rates
 */
export function updateConversionRates(rates: Record<string, number>): void {
  Object.assign(CURRENCY_RATES_TO_NIS, rates);
}

/**
 * Get current conversion rates (for debugging/monitoring)
 * @returns Copy of current conversion rates
 */
export function getConversionRates(): Record<string, number> {
  return { ...CURRENCY_RATES_TO_NIS };
}
