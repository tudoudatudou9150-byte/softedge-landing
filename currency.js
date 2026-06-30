const DEFAULT_PRICING_CONTEXT = {
  country: "US",
  currencyCode: "USD",
  currencySymbol: "$",
  exchangeRate: 1,
  currencyLabel: "US dollars"
};

const formatConvertedMoney = (usdValue, context = window.NUBOHOME_PRICING_CONTEXT || DEFAULT_PRICING_CONTEXT) => {
  const amount = Number(usdValue || 0) * Number(context.exchangeRate || 1);
  return `${context.currencySymbol}${amount.toFixed(2)}`;
};

const applyCurrencyLabels = (context) => {
  document.querySelectorAll("[data-money-usd]").forEach((node) => {
    const prefix = node.dataset.moneyPrefix || "";
    node.textContent = `${prefix}${formatConvertedMoney(node.dataset.moneyUsd, context)}`;
  });

  document.querySelectorAll("[data-currency-label]").forEach((node) => {
    node.textContent = `Prices shown in ${context.currencyCode}`;
  });
};

const loadPricingContext = async () => {
  try {
    const response = await fetch("/api/pricing-context", { cache: "no-store" });
    if (!response.ok) throw new Error("Pricing context unavailable");
    return await response.json();
  } catch {
    return DEFAULT_PRICING_CONTEXT;
  }
};

window.NUBOHOME_PRICING_CONTEXT = DEFAULT_PRICING_CONTEXT;
window.NUBOHOME_FORMAT_MONEY = formatConvertedMoney;
window.NUBOHOME_CURRENCY_READY = loadPricingContext().then((context) => {
  window.NUBOHOME_PRICING_CONTEXT = context;
  applyCurrencyLabels(context);
  return context;
});

applyCurrencyLabels(DEFAULT_PRICING_CONTEXT);
