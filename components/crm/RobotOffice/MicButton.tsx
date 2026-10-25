"use client";
import { useEffect, useState } from "react";
import { TbMicrophone, TbMicrophoneOff } from "react-icons/tb";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { dictationSupported, recorderSupported, useVoiceInput } from "@/components/crm/AiAssistant/voice";

/**
 * Микрофон для полей Робот-офиса: наговорить поручение вместо набора.
 *
 * Используется тот же движок, что у Айрис (браузерное распознавание; при
 * настроенном серверном STT — сервер), поэтому поведение одинаковое. Кнопка
 * не показывается, если браузер не умеет ни то, ни другое.
 */
export default function MicButton({
	onText,
	className = "",
}: {
	onText: (text: string) => void;
	className?: string;
}) {
	const t = useTranslations("office");
	const locale = useLocale();
	const [supported, setSupported] = useState(false);
	useEffect(() => setSupported(dictationSupported() || recorderSupported()), []);

	const { state, start, stop } = useVoiceInput({
		locale,
		serverStt: false, // в карточке робота серверный STT не обязателен: работает браузерное распознавание
		onText,
		onError: (code) => toast.error(t(code === "micDenied" ? "micDenied" : "micUnavailable")),
	});

	if (!supported) return null;
	const listening = state !== "idle";
	return (
		<button
			type="button"
			onClick={() => (listening ? stop() : void start(""))}
			aria-label={listening ? t("micListening") : t("micStart")}
			aria-pressed={listening}
			title={listening ? t("micListening") : t("micStart")}
			className={`${className} ${listening ? "text-[#EB5757]" : "text-[#9aa7c9] hover:text-[#7c93ff]"}`}
		>
			{listening ? <TbMicrophoneOff size={18} aria-hidden /> : <TbMicrophone size={18} aria-hidden />}
		</button>
	);
}
