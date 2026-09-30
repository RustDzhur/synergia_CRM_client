"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbX } from "react-icons/tb";
import type { MailDTO } from "@/types/integrations";
import { localeTag } from "@/utils/dateHelpers";
import Modal from "../../shared/Modal";
import AiQuickAsk from "../../AiAssistant/AiQuickAsk";
import { mailSrcDoc, sanitizeMailHtml } from "./mailHtml";

export default function ReadModal({ mail, onClose }: { mail: MailDTO | null; onClose: () => void }) {
	const t = useTranslations("collab");
	const tAi = useTranslations("ai");
	const locale = useLocale();
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [frameHeight, setFrameHeight] = useState(0);

	// Разметка письма: показываем её в песочнице, чтобы письмо выглядело как оригинал — со ссылками
	// и картинками, но без доступа к кабинету (подробности в mailHtml.ts)
	const doc = useMemo(() => (mail?.html ? mailSrcDoc(sanitizeMailHtml(mail.html)) : ""), [mail?.html]);

	// Высоту окна письма подгоняем под содержимое: картинки догружаются позже, поэтому мерим ещё раз
	useEffect(() => {
		setFrameHeight(0);
		if (!doc) return;
		const measure = () => {
			const height = frameRef.current?.contentDocument?.documentElement?.scrollHeight ?? 0;
			if (height) setFrameHeight(height + 4);
		};
		const timers = [200, 800, 2000].map((ms) => window.setTimeout(measure, ms));
		return () => timers.forEach((id) => window.clearTimeout(id));
	}, [doc]);

	return (
		<Modal open={mail !== null} onClose={onClose} label={mail?.subject} className="w-full max-w-[600px]">
			{/* Окно письма не выше экрана: шапка остаётся на месте, а длинное письмо прокручивается внутри.
			    Без этого длинное письмо уезжало за верх и низ экрана (100dvh учитывает панели браузера) */}
			<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-24">
				<div className="mb-6 flex items-start justify-between gap-16">
					<h2 className="break-words text-16 font-semibold text-[#f1f4ee]">{mail?.subject || t("noSubject")}</h2>
					<div className="flex shrink-0 items-center gap-12 pt-[4px]">
						{mail && (
							<AiQuickAsk
								prompt={tAi("analyzeMailPrompt", { subject: mail.subject || t("noSubject"), from: mail.from })}
								requiredTool="search_mail"
								label={tAi("analyzeMail")}
							/>
						)}
						<button type="button" onClick={onClose} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><TbX size={18} /></button>
					</div>
				</div>
				<p className="mb-20 break-words text-12 text-[#8C948B]">
					{mail?.from} → {mail?.to} · {mail ? new Date(mail.at).toLocaleString(localeTag(locale)) : ""}
				</p>
				<div className="fs-scroll min-h-0 flex-1 overflow-y-auto">
					{doc ? (
						/* sandbox без allow-scripts: разметка письма не может выполнять код. allow-same-origin
						   нужен только чтобы окно подгоняло высоту под содержимое */
						<iframe
							ref={frameRef}
							title={mail?.subject || t("noSubject")}
							srcDoc={doc}
							sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
							className="w-full border-0 bg-transparent"
							style={{ height: frameHeight || 200 }}
						/>
					) : (
						<p className="whitespace-pre-wrap break-words text-13 text-[#f1f4ee]">{mail?.body}</p>
					)}
				</div>
			</div>
		</Modal>
	);
}
