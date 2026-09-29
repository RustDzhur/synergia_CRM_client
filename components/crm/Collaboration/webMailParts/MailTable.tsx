"use client";
import { useLocale, useTranslations } from "next-intl";
import { TbStar, TbStarFilled } from "react-icons/tb";
import type { MailDTO } from "@/types/integrations";
import Checkbox from "../../shared/Checkbox";
import { formatChatDate } from "../format";
import type { MailView } from "./model";

interface Props {
	rows: MailDTO[];
	view: MailView;
	selected: string[];
	syncing: boolean;
	onSelect: (ids: string[]) => void;
	onToggle: (id: string) => void;
	onStar: (m: MailDTO) => void;
	onOpen: (m: MailDTO) => void;
}

export default function MailTable({ rows, view, selected, syncing, onSelect, onToggle, onStar, onOpen }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const allChecked = rows.length > 0 && rows.every((m) => selected.includes(m.id));

	return (
		<div className="fs-card min-h-[280px] overflow-x-auto">
			<table className="fs-table min-w-[480px] table-fixed">
				<thead>
					<tr>
						<th className="w-[46px] pl-16"><Checkbox checked={allChecked} onChange={(v) => onSelect(v ? rows.map((m) => m.id) : [])} label={t("selectAll")} /></th>
						<th className="px-10 text-center">{t("mailName")}</th>
						<th className="w-[230px] px-10 text-center">{t("mailDate")}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((m) => (
						<tr key={m.id} className={`h-[52px] animate-fade-in transition-colors duration-150 ${selected.includes(m.id) ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
							<td className="pl-16"><Checkbox checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} label={t("selectRow")} /></td>
							<td className="px-10">
								<div className="flex items-center gap-10">
									<button type="button" aria-pressed={m.starred} aria-label={t("markStar")} onClick={() => onStar(m)} className={`shrink-0 transition-colors ${m.starred ? "text-[#f4b942]" : "text-[#8C948B] hover:text-[#8c948b]"}`}>
										{m.starred ? <TbStarFilled size={18} /> : <TbStar size={18} />}
									</button>
									<button type="button" onClick={() => onOpen(m)} className={`min-w-0 flex-1 truncate text-left text-13 transition-colors hover:text-[#c6ff4d] ${m.read ? "text-[#8c948b]" : "font-semibold text-[#f1f4ee]"}`}>
										<span className="font-medium">{view === "sent" || view === "draft" ? m.to || "—" : m.from}</span>
										<span className={m.read ? "text-[#8C948B]" : "text-[#8c948b]"}> — {m.subject || t("noSubject")}</span>
									</button>
								</div>
							</td>
							<td className="truncate px-10 text-center text-11 text-[#8c948b]">{formatChatDate(m.at, locale)}</td>
						</tr>
					))}
				</tbody>
			</table>
			{rows.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{syncing ? t("mailSyncing") : t("mailEmpty")}</p>}
		</div>
	);
}
