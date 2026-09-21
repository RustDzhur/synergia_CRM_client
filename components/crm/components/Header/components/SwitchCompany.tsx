"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { RiArrowDownSLine } from "react-icons/ri";
import { useActiveOrg, useOrgStore } from "@/app/store/useOrgStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

// Название фирмы в шапке (Figma: «Switch | название»). Ширину задаёт родитель: 387px в шапке (desktop), на всю ширину в мобильном меню.
// Список — фирмы пользователя: с одного аккаунта можно вести несколько фирм, создать новую и переименовать текущую.
export default function SwitchCompany() {
	const t = useTranslations("navBar");
	const { orgs, activeId, load, switchOrg, create, rename } = useOrgStore();
	const active = useActiveOrg();
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"none" | "new" | "rename">("none");
	const [name, setName] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);
	useClickOutside(rootRef, open, () => { setOpen(false); setMode("none"); });

	useEffect(() => { load(); }, [load]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const value = name.trim();
		if (!value) return;
		const res = mode === "new" ? await create(value) : await rename(value);
		if (!res.ok) return void toast.error(res.message);
		setMode("none");
		setOpen(false);
	}

	const canRename = active?.role === "owner" || active?.role === "admin";
	const row = "flex h-50 w-full items-center px-20 text-left text-16 font-medium transition-colors duration-150 hover:bg-gray";

	return (
		<div ref={rootRef} className="flex w-full">
			<button type="button" onClick={() => setOpen(!open)} className="shrink-0 h-50 px-20 cursor-pointer border-t-switchCompany border-b-switchCompany border-l-switchCompany rounded-l-8 shadow-custom">
				<p className="font-medium text-16 text-primaryColor whitespace-nowrap">{t("switch")}</p>
			</button>
			<div className="relative flex-1 min-w-0">
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className="flex items-center justify-between w-full h-50 px-20 cursor-pointer border-t-switchCompany border-b-switchCompany border-r-switchCompany rounded-r-8 shadow-custom">
					<p className="font-medium text-16 text-black truncate">{active ? active.name : t("company")}</p>
					<RiArrowDownSLine size={24} color="#4D4D4D" className={`ml-10 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
				</button>
				<Dropdown open={open} className="left-0 right-0 top-full">
					<div className="overflow-hidden rounded-b-8 border border-[#E2F1F5] border-t-0 bg-headerBackground shadow-custom">
						<ul>
							{orgs.map((o) => (
								<li key={o.id} className="border-t border-[#E2F1F5]">
									<button type="button" onClick={() => (o.id === activeId ? setOpen(false) : switchOrg(o.id))} className={`${row} ${o.id === activeId ? "bg-gray" : ""}`}>
										<span className="min-w-0 flex-1 truncate text-black">{o.name}</span>
										<span className="ml-10 shrink-0 text-12 font-normal text-[#999999]">{t(`role_${o.role}`)}</span>
									</button>
								</li>
							))}
						</ul>
						{mode === "none" ? (
							<>
								<button type="button" onClick={() => { setName(""); setMode("new"); }} className={`${row} border-t border-[#E2F1F5] text-primaryColor`}>＋ {t("newFirm")}</button>
								{canRename && <button type="button" onClick={() => { setName(active?.name ?? ""); setMode("rename"); }} className={`${row} border-t border-[#E2F1F5] text-[#666666]`}>{t("renameFirm")}</button>}
							</>
						) : (
							<form onSubmit={submit} className="flex items-center gap-8 border-t border-[#E2F1F5] p-10">
								<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder={t("firmName")} aria-label={t("firmName")} className="h-[40px] min-w-0 flex-1 rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-black outline-none focus:border-[#5EA8F5]" />
								<button type="submit" className="h-[40px] shrink-0 rounded-8 bg-primaryColor px-16 text-16 font-medium text-white transition-opacity hover:opacity-80">{mode === "new" ? t("create") : t("save")}</button>
							</form>
						)}
					</div>
				</Dropdown>
			</div>
		</div>
	);
}
