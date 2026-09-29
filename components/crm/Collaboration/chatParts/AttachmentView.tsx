"use client";
import { useTranslations } from "next-intl";
import { TbFile } from "react-icons/tb";
import type { AttachmentDTO } from "@/types/integrations";
import { sizeLabel } from "./model";

// Вложение сообщения: фото показываем, звук проигрываем, остальное отдаём карточкой файла со скачиванием
export default function AttachmentView({ a, url, mine }: { a: AttachmentDTO; url?: string; mine: boolean }) {
	const t = useTranslations("collab");
	const frame = `overflow-hidden rounded-14 border border-inkLine ${mine ? "bg-[rgba(198,255,77,0.14)]" : "bg-[rgba(255,255,255,0.05)]"}`;
	if (!url) return <div className={`${frame} px-16 py-10 text-13 text-[#8c948b]`}>{t("attachmentLoading")}</div>;
	if (a.kind === "image")
		return (
			<a href={url} target="_blank" rel="noreferrer" title={a.name} className="block max-w-[85%] transition-transform duration-150 hover:scale-[1.01] motion-reduce:transform-none">
				<img src={url} alt={a.name} className="max-h-[320px] w-auto max-w-full rounded-14 border border-inkLine" />
			</a>
		);
	if (a.kind === "voice")
		return (
			<div className={`${frame} flex items-center gap-12 px-14 py-8`}>
				<audio controls src={url} className="h-[34px] w-[220px]" aria-label={t("mediaVoice")} />
			</div>
		);
	return (
		<a href={url} download={a.name} className={`${frame} flex max-w-[85%] items-center gap-10 px-14 py-10`}>
			<span className="shrink-0 text-[#c6ff4d]"><TbFile size={24} /></span>
			<span className="min-w-0">
				<span className="block truncate text-13 text-[#f1f4ee]">{a.name}</span>
				<span className="block text-11 text-[#8c948b]">{sizeLabel(a.size)}</span>
			</span>
		</a>
	);
}
