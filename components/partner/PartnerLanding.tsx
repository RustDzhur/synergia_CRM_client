"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Info { name: string; bankProvider: string; code: string }

// Клиент пришёл по ссылке банка: код запоминается, после входа первым шагом предлагается подключить счёт этого банка.
// Другие банки не скрыты, а согласие на учёт объёма платежей в агрегатах банка — отдельная галочка (по умолчанию выключена).
export default function PartnerLanding({ code }: { code: string }) {
	const t = useTranslations("partner");
	const [info, setInfo] = useState<Info | null | undefined>(undefined);
	const [share, setShare] = useState(false);

	useEffect(() => {
		void (async () => {
			const r = await fetch(`/api/partner/${encodeURIComponent(code)}`).catch(() => null);
			if (!r || !r.ok) return setInfo(null);
			setInfo(await r.json());
			void fetch(`/api/partner/${encodeURIComponent(code)}`, { method: "POST" }).catch(() => undefined);
		})();
	}, [code]);

	function remember() {
		try {
			localStorage.setItem("partner.code", code.toUpperCase());
			localStorage.setItem("partner.share", share ? "1" : "0");
		} catch { /* приватный режим: код можно ввести позже в бухгалтерии */ }
	}

	if (info === undefined) return <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-13 text-[#8c948b]">…</main>;
	if (info === null) return (
		<main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-20 text-center">
			<div className="max-w-[420px]"><h1 className="text-18 font-semibold text-[#f1f4ee]">{t("goneTitle")}</h1><p className="mt-10 text-13 text-[#8c948b]">{t("goneText")}</p></div>
		</main>
	);
	return (
		<main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-20">
			<div className="fs-card w-full max-w-[520px] p-24">
				<h1 className="text-20 font-semibold text-[#f1f4ee]">{t("landingTitle", { bank: info.name })}</h1>
				<p className="mt-10 text-13 leading-[1.6] text-[#8c948b]">{t("landingText", { bank: info.name })}</p>
				<ul className="mt-14 list-disc pl-18 text-13 leading-[1.7] text-[#cfd4cb]">
					<li>{t("landingPoint1", { bank: info.name })}</li>
					<li>{t("landingPoint2")}</li>
					<li>{t("landingPoint3")}</li>
				</ul>
				<label className="mt-16 flex items-start gap-10 text-12 leading-[1.5] text-[#cfd4cb]">
					<input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-3" />
					<span>{t("shareVolume", { bank: info.name })}</span>
				</label>
				<Link href="/crm" onClick={remember} className="fs-btn fs-btn-primary mt-18 inline-flex h-42 items-center px-20">{t("landingCta")}</Link>
			</div>
		</main>
	);
}
