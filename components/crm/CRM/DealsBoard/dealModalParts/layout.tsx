"use client";
import React from "react";
import { useTranslations } from "next-intl";

export function Card({ children }: { children: React.ReactNode }) {
	return <section className="fs-card overflow-hidden">{children}</section>;
}

export function CardHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
	return (
		<header className="flex items-center justify-between border-b border-inkLine px-16 py-12">
			<h3 className="text-14 font-semibold text-[#f1f4ee]">{title}</h3>
			<button type="button" onClick={onAction} className="text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
				{action}
			</button>
		</header>
	);
}

export function Row({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
	return (
		<div className="mb-12 last:mb-0">
			<p className="text-12 text-[#8c948b]">{label}</p>
			<p className={`mt-6 text-15 font-semibold ${accent ? "text-[#c6ff4d]" : "text-[#f1f4ee]"}`}>{children || "—"}</p>
		</div>
	);
}

export function SectionFooter({ onDelete }: { onDelete: () => void }) {
	const t = useTranslations("crm");
	return (
		<footer className="flex flex-wrap items-center justify-between gap-x-16 gap-y-6 border-t border-inkLine px-16 py-12 text-12">
			<div className="flex gap-14 whitespace-nowrap text-[#9AA396]">
				<button type="button" disabled title={t("soon")} className="cursor-not-allowed opacity-60">{t("selectField")}</button>
				<button type="button" disabled title={t("soon")} className="cursor-not-allowed opacity-60">{t("createField")}</button>
			</div>
			<button type="button" onClick={onDelete} className="text-[#8c948b] underline transition-colors hover:text-[#f1f4ee]">
				{t("deleteSection")}
			</button>
		</footer>
	);
}

export function SaveRow({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
	const t = useTranslations("crm");
	return (
		<div className="mt-14 flex items-center justify-end gap-10">
			<button type="button" onClick={onCancel} className="px-12 py-8 text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">{t("cancel")}</button>
			<button type="button" onClick={onSave} className="fs-btn fs-btn-primary h-34">
				{t("save")}
			</button>
		</div>
	);
}
