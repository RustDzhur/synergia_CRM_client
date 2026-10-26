import type { IconType } from "react-icons";
import { TbAlarm, TbCircleCheck, TbInbox, TbNote, TbStar } from "react-icons/tb";
import type { MailDTO, MailProviderId } from "@/types/integrations";

export type MailView = "inbox" | "starred" | "snoozed" | "sent" | "draft";

export const VIEWS: { key: MailView; icon: IconType }[] = [
	{ key: "inbox", icon: TbInbox },
	{ key: "starred", icon: TbStar },
	{ key: "snoozed", icon: TbAlarm },
	{ key: "sent", icon: TbCircleCheck },
	{ key: "draft", icon: TbNote },
];

export function inView(m: MailDTO, view: MailView) {
	if (view === "starred") return m.starred;
	if (view === "snoozed") return m.snoozed;
	if (view === "inbox") return m.folder === "inbox" && !m.snoozed;
	return m.folder === view;
}

export const LABELS: Record<MailProviderId, string> = { gmail: "Google Mail", outlook: "Outlook", yahoo: "Yahoo", icloud: "iCloud", office365: "Office 365", imap: "IMAP" };

// body — обычный текст (text/plain), html — разметка из редактора письма. Храним оба: письмо уходит
// multipart/alternative, а черновик открывается с сохранённым форматированием.
export interface Draft { id: string; to: string; subject: string; body: string; html: string }
export const EMPTY_DRAFT: Draft = { id: "", to: "", subject: "", body: "", html: "" };
