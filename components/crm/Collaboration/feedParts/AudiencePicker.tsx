"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbUser, TbUsers } from "react-icons/tb";
import { api } from "@/store/crmApi";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

interface Member { userId: string; name: string; email: string; you?: boolean; source?: "member" | "employee" }
// Сотрудник из справочника «Моя фирма»: аккаунта у него может и не быть — тогда он только адресат в тексте
interface Employee { _id: string; firstname: string; lastname: string; email: string; position?: string }

// Кому адресована запись: вся фирма или выбранные люди
export default function AudiencePicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
	const t = useTranslations("collab");
	const [open, setOpen] = useState(false);
	const [members, setMembers] = useState<Member[]>([]);
	const [loaded, setLoaded] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const close = useCallback(() => setOpen(false), []);
	useClickOutside(ref, open, close);

	// Людей спрашиваем при первом открытии списка, а не при загрузке страницы.
	// Берём и участников фирмы (у них есть аккаунт), и сотрудников из справочника «Моя фирма»:
	// без второго списка адресат не находился, хотя человек в фирме заведён.
	useEffect(() => {
		if (!open || loaded) return;
		let alive = true;
		Promise.all([
			api<{ members: Member[] }>("/api/orgs/members"),
			api<{ items: Employee[] }>("/api/employees?page=1"),
		]).then(([org, staff]) => {
			if (!alive) return;
			const list: Member[] = (org?.members ?? []).filter((m) => !m.you).map((m) => ({ ...m, source: "member" as const }));
			// сотрудника с почтой, совпадающей с участником, второй раз не показываем — это один человек
			const memberEmails = new Set(list.map((m) => (m.email ?? "").toLowerCase()).filter(Boolean));
			for (const e of staff?.items ?? []) {
				const email = (e.email ?? "").toLowerCase();
				if (email && memberEmails.has(email)) continue;
				list.push({ userId: e._id, name: `${e.firstname} ${e.lastname}`.trim(), email: e.email, source: "employee" });
			}
			setMembers(list);
			setLoaded(true);
		});
		return () => { alive = false; };
	}, [open, loaded]);

	const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={`flex h-34 items-center gap-8 rounded-10 border px-12 text-12 transition-colors ${ids.length ? "border-inkAccentLine text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
				{ids.length === 1 ? <TbUser size={16} aria-hidden /> : <TbUsers size={16} aria-hidden />}
				{ids.length ? `${t("toWhom")} ${ids.length}` : t("pickRecipients")}
			</button>
			<Dropdown open={open} className="bottom-full left-0 mb-8 w-[260px]">
				<div className="fs-popover fs-scroll max-h-[260px] overflow-y-auto p-4">
					<button
						type="button"
						onClick={() => { onChange([]); close(); }}
						className={`fs-popover-row block w-full rounded-8 px-12 py-8 text-left text-13 transition-colors ${ids.length ? "" : "font-medium !text-[#c6ff4d]"}`}>
						{t("everyone")}
					</button>
					{members.map((m) => (
						<label key={m.userId} className="fs-popover-row flex cursor-pointer items-center gap-10 rounded-8 px-12 py-8 text-13 transition-colors">
							<input type="checkbox" checked={ids.includes(m.userId)} onChange={() => toggle(m.userId)} className="h-[15px] w-[15px] accent-[#c6ff4d]" />
							<span className="min-w-0 flex-1">
								<span className="block truncate">{m.name}</span>
								{/* У сотрудника из справочника может не быть аккаунта: он попадёт в адресаты записи,
								    но уведомление ему прийти не может — честнее сказать это сразу */}
								{m.source === "employee" && <span className="block truncate text-11 text-[#9AA396]">{t("employeeNoAccount")}</span>}
							</span>
						</label>
					))}
					{loaded && members.length === 0 && <p className="px-12 py-8 text-12 text-[#8C948B]">{t("noColleagues")}</p>}
				</div>
			</Dropdown>
		</div>
	);
}
