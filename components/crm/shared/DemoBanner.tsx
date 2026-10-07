"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import useAuthStore from "@/store/useAuthStore";

// Узкая плашка над кабинетом, пока человек в демо: что это за режим, что изменения исчезнут при выходе, и куда идти дальше.
export default function DemoBanner() {
	const t = useTranslations("demo");
	const locale = useLocale();
	const logout = useAuthStore((s) => s.logout);
	const [demo, setDemo] = useState(false);

	useEffect(() => {
		try { setDemo(JSON.parse(atob((localStorage.getItem("token") ?? "").split(".")[1] ?? ""))?.demo === true); } catch { setDemo(false); }
	}, []);
	if (!demo) return null;

	const leave = (toSignup: boolean) => { logout(); window.location.assign(`/${locale}${toSignup ? "#choose-plan" : ""}`); };
	return (
		<div role="status" className="flex flex-wrap items-center justify-center gap-x-16 gap-y-6 border-b border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.10)] px-16 py-8 text-center text-12 text-[#e6ecdf]">
			<span><b className="font-semibold text-[#c6ff4d]">{t("bannerTitle")}</b> {t("bannerText")}</span>
			<span className="flex gap-12">
				<button type="button" onClick={() => leave(true)} className="font-semibold text-[#c6ff4d] underline underline-offset-2 hover:opacity-80">{t("bannerRegister")}</button>
				<button type="button" onClick={() => leave(false)} className="text-[#cfd4cb] underline underline-offset-2 hover:text-white">{t("bannerExit")}</button>
			</span>
		</div>
	);
}
