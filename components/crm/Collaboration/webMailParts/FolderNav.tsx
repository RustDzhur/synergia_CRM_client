"use client";
import { useTranslations } from "next-intl";
import { MailView, VIEWS } from "./model";

interface Props { view: MailView; unreadInbox: number; onChange: (view: MailView) => void }

export default function FolderNav({ view, unreadInbox, onChange }: Props) {
	const t = useTranslations("collab");
	return (
		<nav aria-label={t("mailFolders")} className="fs-card w-full shrink-0 self-start p-8 md:w-auto md:min-w-[166px] md:max-w-[280px]">
			<ul>
				{VIEWS.map(({ key, icon: Icon }, i) => (
					<li key={key} className={i > 0 ? "border-t border-inkLineSoft" : ""}>
						<button
							type="button"
							onClick={() => onChange(key)}
							aria-current={view === key ? "page" : undefined}
							className={`flex h-44 w-full items-center gap-10 rounded-8 px-12 text-left text-13 font-medium transition-colors duration-200 ${view === key ? "bg-[rgba(198,255,77,0.08)] text-[#c6ff4d]" : "text-[#8c948b] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f1f4ee]"}`}>
							<Icon size={20} className="shrink-0" />
							<span className="flex-1 truncate">{t(`folder_${key}`)}</span>
							{key === "inbox" && unreadInbox > 0 && <span className="text-11 text-[#8C948B]">{unreadInbox}</span>}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}
