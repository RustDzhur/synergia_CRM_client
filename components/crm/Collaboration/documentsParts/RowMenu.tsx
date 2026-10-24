"use client";
import { useTranslations } from "next-intl";
import { TbDots } from "react-icons/tb";
import Menu from "@/components/crm/Tasks/tasksParts/Menu";
import type { Action } from "./model";

// Меню «⋯» строки/плитки документа. Панель рисуется порталом поверх страницы (см. Menu), поэтому её не перекрывают соседние плитки
// и не обрезает прокручиваемая таблица.
export default function RowMenu({ actions }: { actions: Action[] }) {
	const t = useTranslations("collab");
	return (
		<Menu align="right" options={actions.map((a) => ({ label: a.label, danger: a.danger, onClick: a.onClick }))}>
			{({ open, toggle }) => (
				<button type="button" aria-label={t("more")} aria-expanded={open} onClick={toggle} className="text-[#9aa7c9] transition-colors hover:text-[#7c93ff]">
					<TbDots size={20} />
				</button>
			)}
		</Menu>
	);
}
