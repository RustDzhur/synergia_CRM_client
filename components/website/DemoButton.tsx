"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlayerPlayFilled } from "react-icons/tb";
import useAuthStore from "@/store/useAuthStore";

// «Спробувати демо»: вход без регистрации в заполненный кабинет-образец. Копия своя у каждого посетителя и стирается при выходе
// (сервер — lib/demo). className задаёт вид кнопки там, где она стоит (лендинг, шапка).
export default function DemoButton({ className = "", label, onDone }: { className?: string; label?: string; onDone?: () => void }) {
	const t = useTranslations("demo");
	const locale = useLocale();
	const startDemo = useAuthStore((s) => s.startDemo);
	const [busy, setBusy] = useState(false);

	async function go() {
		if (busy) return;
		setBusy(true);
		const res = await startDemo(locale);
		if (res.ok) {
			onDone?.();
			// полная загрузка: данные кабинета в памяти вкладки не должны смешаться с прежними
			window.location.assign(`/${locale}/crm`);
			return;
		}
		setBusy(false);
		toast.error(res.code === "too_many" ? t("tooMany") : res.code === "busy" ? t("busy") : t("failed"));
	}

	return (
		<button type="button" onClick={() => void go()} disabled={busy} className={className}>
			{busy ? t("starting") : <><TbPlayerPlayFilled size={15} aria-hidden />{label ?? t("try")}</>}
		</button>
	);
}
