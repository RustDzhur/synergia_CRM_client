"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ShareView } from "@/lib/share";

// Клиентская часть публичной страницы: выбор позиций и принятие предложения.
// Страница одна на два случая — заказ (статус, доставка, оплата) и предложение (выбор и согласие).

// Сумму собираем сами, а не через Intl: сервер и браузер форматируют валюту по-разному
// («1 250,00 ₴» против «1 250,00 грн»), и страница ломалась на гидратации.
const SIGN: Record<string, string> = { UAH: "₴", USD: "$", EUR: "€" };
const money = (n: number, currency: string) => {
    const value = (n || 0)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
        .replace(".", ",");
    return `${value} ${SIGN[currency] ?? currency}`;
};

export default function ShareClient({ data, token }: { data: ShareView; token: string }) {
    const t = useTranslations("share");
    // Режим рынка фирмы: украинская фирма показывает «Рахунок» и «Комерційну пропозицію» и номер
    // договора рядом — клиент видит документ в привычных ему словах (ТЗ A16)
    const ua = data.market === "UA";
    const [picked, setPicked] = useState<number[]>(() => data.items.map((_, i) => i));
    const [accepted, setAccepted] = useState(data.status === "accepted");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const total = data.items.filter((_, i) => picked.includes(i)).reduce((sum, i) => sum + i.qty * i.price, 0);

    async function accept() {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const res = await fetch(`/api/public/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept: true, items: picked }) });
            const json = (await res.json().catch(() => null)) as { message?: string } | null;
            if (!res.ok) throw new Error(json?.message || t("acceptFailed"));
            setAccepted(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : t("acceptFailed"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#0a0a0a] px-16 py-32 text-[#f1f4ee] md:px-24">
            <div className="mx-auto w-full max-w-[720px]">
                <header className="mb-20 flex flex-wrap items-center gap-14">
                    {data.company.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.company.logo} alt={data.company.name} className="h-40 w-40 rounded-10 object-contain" />
                    ) : null}
                    <div className="min-w-0">
                        <p className="text-15 font-semibold">{data.company.name || "—"}</p>
                        <p className="text-12 text-[#8c948b]">{[data.company.phone, data.company.email, data.company.site].filter(Boolean).join(" · ")}</p>
                    </div>
                </header>

                <section className="rounded-14 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-20">
                    <p className="text-12 uppercase tracking-wide text-[#8c948b]">{data.kind === "order" ? (ua ? t("orderTitleUa") : t("orderTitle")) : ua ? t("quoteTitleUa") : t("quoteTitle")}</p>
                    <h1 className="mt-6 text-22 font-semibold">{data.number}</h1>
                    <p className="mt-6 text-13 text-[#8c948b]">
                        {data.customer}
                        {data.validUntil ? ` · ${t("validUntil")}: ${data.validUntil}` : ""}
                        {data.contract ? ` · ${t("contract")}: ${data.contract}` : ""}
                    </p>

                    {data.kind === "order" && (
                        <p className="mt-14 inline-flex rounded-full bg-[rgba(198,255,77,0.12)] px-12 py-4 text-12 font-medium text-[#c6ff4d]">
                            {t(`status_${data.status}` as never)}
                        </p>
                    )}
                    {data.delivery && (
                        <p className="mt-10 text-13 text-[#cfd4cb]">
                            {data.delivery.carrier}: <span className="font-medium">{data.delivery.number}</span>
                            {data.delivery.status ? ` · ${data.delivery.status}` : ""}
                        </p>
                    )}
                </section>

                <section className="mt-16 overflow-x-auto rounded-14 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]">
                    <table className="w-full min-w-[420px] text-13">
                        <thead>
                            <tr className="text-left text-11 uppercase tracking-wide text-[#8c948b]">
                                {data.kind === "quote" && <th className="w-40 px-16 py-12" aria-label={t("choose")} />}
                                <th className="px-16 py-12">{t("colName")}</th>
                                <th className="px-10 py-12 text-right">{t("colQty")}</th>
                                <th className="px-10 py-12 text-right">{t("colPrice")}</th>
                                <th className="px-16 py-12 text-right">{t("colSum")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, i) => {
                                const on = picked.includes(i);
                                return (
                                    <tr key={`${item.name}-${i}`} className={`border-t border-[rgba(255,255,255,0.06)] ${on ? "" : "opacity-50"}`}>
                                        {data.kind === "quote" && (
                                            <td className="px-16 py-12">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    disabled={accepted}
                                                    onChange={() => setPicked((list) => (on ? list.filter((x) => x !== i) : [...list, i]))}
                                                    className="h-16 w-16 accent-[#c6ff4d]"
                                                    aria-label={item.name}
                                                />
                                            </td>
                                        )}
                                        <td className="px-16 py-12">{item.name}</td>
                                        <td className="px-10 py-12 text-right">{item.qty}</td>
                                        <td className="px-10 py-12 text-right">{money(item.price, data.currency)}</td>
                                        <td className="px-16 py-12 text-right font-medium">{money(on ? item.qty * item.price : 0, data.currency)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.10)] px-16 py-14">
                        <span className="text-13 font-semibold">{t("total")}</span>
                        <span className="text-16 font-semibold text-[#c6ff4d]">{money(total, data.currency)}</span>
                    </div>
                </section>

                {error && <p className="mt-12 text-13 text-[#eb5757]">{error}</p>}

                {data.kind === "quote" && (
                    <div className="mt-20">
                        {accepted ? (
                            <p className="rounded-12 border border-[rgba(45,222,182,0.35)] bg-[rgba(45,222,182,0.08)] p-14 text-13 text-[#2DDEB6]">{t("accepted")}</p>
                        ) : (
                            <button type="button" onClick={() => void accept()} disabled={busy || picked.length === 0} className="h-46 w-full rounded-10 bg-[#c6ff4d] text-14 font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:opacity-50 md:w-auto md:px-32">
                                {busy ? t("accepting") : t("accept")}
                            </button>
                        )}
                    </div>
                )}

                {data.kind === "order" && data.payment && !data.payment.paid && data.payment.url && (
                    <a href={data.payment.url} className="mt-20 inline-flex h-46 items-center justify-center rounded-10 bg-[#c6ff4d] px-32 text-14 font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90">
                        {t("payInvoice", { number: data.payment.number })}
                    </a>
                )}
                {data.kind === "order" && data.payment?.paid && (
                    <p className="mt-20 rounded-12 border border-[rgba(45,222,182,0.35)] bg-[rgba(45,222,182,0.08)] p-14 text-13 text-[#2DDEB6]">{t("paid")}</p>
                )}

                <p className="mt-24 text-center text-11 text-[#8c948b]">{t("footer")}</p>
            </div>
        </main>
    );
}
