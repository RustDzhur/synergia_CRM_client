"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbChevronDown, TbPlus } from "react-icons/tb";
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
	const row = "fs-popover-row flex h-40 w-full items-center gap-8 px-14 text-left text-13 font-medium transition-colors duration-150";

	return (
		<div ref={rootRef} className="w-full">
			{/* единый тёмный бокс: слева метка «Switch», справа название фирмы; обе половины открывают список */}
			<div className="fs-field relative flex h-46 w-full items-center rounded-10">
				<button type="button" onClick={() => setOpen(!open)} className="h-full shrink-0 cursor-pointer rounded-l-10 px-14 text-12 font-medium text-[#c6ff4d] whitespace-nowrap transition-colors hover:bg-[rgba(255,255,255,0.05)]">
					{t("switch")}
				</button>
				<span className="h-20 w-px shrink-0 bg-[rgba(255,255,255,0.09)]" aria-hidden />
				<div className="flex-1 min-w-0">
					<button
						type="button"
						aria-expanded={open}
						onClick={() => setOpen(!open)}
						className="flex items-center justify-between w-full h-46 px-14 cursor-pointer rounded-r-10 transition-colors hover:bg-[rgba(255,255,255,0.05)]">
						<p className="min-w-0 flex-1 font-medium text-13 text-[#f1f4ee] truncate">{active ? active.name : t("company")}</p>
						<TbChevronDown size={16} className={`ml-10 shrink-0 text-[#8c948b] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
					</button>
				</div>
				<Dropdown open={open} className="left-0 right-0 top-full mt-6">
					<div className="fs-popover fs-scroll max-h-[320px] overflow-y-auto">
						<ul>
							{orgs.map((o) => (
								<li key={o.id}>
									<button type="button" onClick={() => (o.id === activeId ? setOpen(false) : switchOrg(o.id))} className={`${row} ${o.id === activeId ? "bg-[rgba(255,255,255,0.05)]" : ""}`}>
										<span className="min-w-0 flex-1 truncate text-[#f1f4ee]">{o.name}</span>
										<span className="ml-10 shrink-0 text-11 font-normal text-[#9AA396]">{t(`role_${o.role}`)}</span>
									</button>
								</li>
							))}
						</ul>
						{mode === "none" ? (
							<>
								<button type="button" onClick={() => { setName(""); setMode("new"); }} className={`${row} border-t border-inkLine text-[#c6ff4d]`}><TbPlus size={14} className="shrink-0" /> {t("newFirm")}</button>
								{canRename && <button type="button" onClick={() => { setName(active?.name ?? ""); setMode("rename"); }} className={`${row} border-t border-inkLine text-[#8c948b]`}>{t("renameFirm")}</button>}
							</>
						) : (
							<form onSubmit={submit} className="flex items-center gap-8 border-t border-inkLine p-10">
								<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder={t("firmName")} aria-label={t("firmName")} className="fs-field h-34 min-w-0 flex-1 px-10 text-12 outline-none" />
								<button type="submit" className="fs-btn fs-btn-primary h-34 shrink-0 text-12">{mode === "new" ? t("create") : t("save")}</button>
							</form>
						)}
					</div>
				</Dropdown>
			</div>
		</div>
	);
}
