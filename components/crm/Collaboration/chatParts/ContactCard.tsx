"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ConversationDTO } from "@/types/integrations";
import Avatar from "../../shared/Avatar";
import { initialsOf } from "../format";
import ChannelBadge from "./ChannelBadge";

// Карточка собеседника над перепиской: имя, канал, аватар (или инициалы) и переход в обычную карточку
// контакта CRM. Контакт заводится при первом входящем сообщении канала (lib/channels/contact.ts);
// у старых бесед карточка восстанавливается при первом открытии переписки (GET /api/conversations/:id).
export default function ContactCard({ conversation }: { conversation: ConversationDTO }) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const contact = conversation.contact;
	const name = contact?.name || conversation.name;
	const channel = contact?.channel || conversation.channel;
	const first = contact?.firstContactAt
		? new Date(contact.firstContactAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
		: "";

	return (
		<div className="flex items-center gap-12 border-b border-inkLine bg-[rgba(124,147,255,0.055)] px-16 py-10 md:px-20">
			<Avatar src={contact?.avatar || undefined} initials={initialsOf(name)} size={40} className="flex text-13" />
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-center gap-6 text-13 font-semibold text-[#edf2ff]">
					<span className="truncate">{name}</span>
					<ChannelBadge channel={channel} size={15} />
				</p>
				<p className="mt-2 truncate text-11 text-[#9aa7c9]">
					{t(`ch_${channel}`)}
					{first ? ` · ${t("firstContact", { date: first })}` : ""}
				</p>
			</div>
			{contact && (
				<Link
					href={`/${locale}/crm/crm/contacts/${contact.id}`}
					className="shrink-0 rounded-8 border border-[rgba(124,147,255,0.35)] px-10 py-6 text-11 font-medium text-[#a8b7ff] transition-colors hover:bg-[#7c93ff]/10">
					{t("openContact")}
				</Link>
			)}
		</div>
	);
}
