"use client";
import { useLocale, useTranslations } from "next-intl";
import type { ConversationDTO } from "@/types/integrations";
import Avatar from "../../shared/Avatar";
import { formatChatDate, initialsOf } from "../format";
import ChannelBadge from "./ChannelBadge";

export default function ChatList({ chats, activeId, onSelect }: { chats: ConversationDTO[]; activeId: string | null; onSelect: (id: string) => void }) {
	const t = useTranslations("collab");
	const locale = useLocale();
	if (chats.length === 0) return <p className="p-30 text-center text-13 text-[#8c948b]">{t("chatsEmpty")}</p>;
	return (
		<ul>
			{chats.map((c) => {
				const active = c.id === activeId;
				return (
					<li key={c.id}>
						<button
							type="button"
							onClick={() => onSelect(c.id)}
							aria-current={active ? "true" : undefined}
							className={`flex w-full items-center gap-12 border-b border-inkLineSoft px-14 py-14 text-left transition-colors duration-150 last:border-b-0 ${active ? "bg-[rgba(198,255,77,0.08)]" : "hover:bg-[rgba(255,255,255,0.04)]"}`}>
							<Avatar initials={initialsOf(c.name)} size={44} className="flex text-14" />
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-8">
									<p className="flex min-w-0 items-center gap-6 text-13 font-semibold text-[#f1f4ee]">
											<ChannelBadge channel={c.channel} />
											<span className="truncate">{c.name}</span>
										</p>
									<p className="shrink-0 whitespace-nowrap text-11 text-[#8C948B] md:max-lg:hidden">{formatChatDate(c.lastAt, locale)}</p>
								</div>
								<div className="mt-2 flex items-end justify-between gap-8">
									<p className="truncate text-12 text-[#8c948b]">{c.lastText}</p>
									{c.unread > 0 && (
										<span className="flex h-20 min-w-22 shrink-0 items-center justify-center rounded-50 bg-[#c6ff4d] px-6 text-11 font-semibold text-[#0a0c0b]">
											{c.unread}
										</span>
									)}
								</div>
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
