const EUROPE_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "BG", "CZ", "DK", "GB",
  "HU", "IS", "LI", "NO", "PL", "RO", "SE", "CH"
]);

const currencyConfig = {
  USD: { code: "USD", symbol: "$", rate: 1, label: "US dollars" },
  AUD: { code: "AUD", symbol: "A$", rate: 1.55, label: "Australian dollars" },
  EUR: { code: "EUR", symbol: "€", rate: 0.92, label: "euros" }
};

const getCountry = (req) => {
  const country = req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "";
  return Array.isArray(country) ? country[0] : String(country).toUpperCase();
};

const getCurrencyForCountry = (country) => {
  if (country === "AU") return currencyConfig.AUD;
  if (EUROPE_COUNTRIES.has(country)) return currencyConfig.EUR;
  return currencyConfig.USD;
};

const getPricingContext = (req) => {
  const country = getCountry(req);
  const currency = getCurrencyForCountry(country);
  return {
    country: country || "US",
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
    exchangeRate: currency.rate,
    currencyLabel: currency.label
  };
};

const convertUsd = (usdValue, context) => (Number(usdValue || 0) * Number(context.exchangeRate || 1)).toFixed(2);

module.exports = {
  convertUsd,
  getPricingContext
};
