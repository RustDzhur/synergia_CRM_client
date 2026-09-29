// Сумма в валюте по немецким правилам (документы и письма всегда идут в формате de-DE);
// если валюта не распознана, показываем число и код как есть
export const formatMoney = (n: number, currency: string) => {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
    catch { return `${n.toFixed(2)} ${currency}`; }
};
