import { getTranslations } from "next-intl/server";

export { generateMetadata } from "./metadata";

// Публичная страница возврата после оплаты: клиент фирмы попадает сюда с сайта эквайринга.
// Ничего не показывает про счёт — только подтверждение, что платёж прошёл и можно вернуться к делам.
export default async function PayDonePage() {
    const t = await getTranslations("payDone");
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-20 text-center">
            <div className="max-w-[420px]">
                <div className="mx-auto mb-20 flex h-56 w-56 items-center justify-center rounded-full bg-[rgba(198,255,77,0.12)] text-[#c6ff4d]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                </div>
                <h1 className="text-20 font-semibold text-[#f1f4ee]">{t("title")}</h1>
                <p className="mt-10 text-13 leading-[1.6] text-[#8c948b]">{t("text")}</p>
            </div>
        </main>
    );
}
