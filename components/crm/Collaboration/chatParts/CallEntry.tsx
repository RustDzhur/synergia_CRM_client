"use client";
import { useTranslations } from "next-intl";
import { TbPhoneIncoming, TbPhoneOutgoing, TbPhoneX } from "react-icons/tb";
import type { MessageDTO } from "@/types/integrations";
import { hhmm } from "../format";
import { mmss } from "./model";

// Строка о звонке в переписке: направление, итог, длительность
export default function CallEntry({ m }: { m: MessageDTO }) {
	const t = useTranslations("collab");
	const status = String(m.meta.status ?? "");
	const duration = Number(m.meta.duration) || 0;
	const done = status === "completed";
	let label: string;
	let Icon = m.direction === "in" ? TbPhoneIncoming : TbPhoneOutgoing;
	if (m.direction === "in") {
		label = done ? t("callLogIn", { duration: mmss(duration) }) : t("callLogMissed");
		if (!done) Icon = TbPhoneX;
	} else {
		label = done ? t("callLogOut", { duration: mmss(duration) }) : status === "no-answer" ? t("callLogNoAnswer") : status === "busy" ? t("callLogBusy") : t("callLogFailed");
	}
	return (
		<div className="flex animate-fade-in items-center justify-center gap-8 text-12 text-[#8c948b]">
			<Icon size={16} className={done ? "text-[#c6ff4d]" : "text-danger"} />
			<span>{label}</span>
			<span>{hhmm(new Date(m.at))}</span>
		</div>
	);
}
