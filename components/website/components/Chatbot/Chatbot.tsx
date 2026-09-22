"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdChatBubble, MdClose, MdSend } from "react-icons/md";
import { withLocale } from "@/app/utils/locale";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { CHATBOT_FAQ } from "@/app/content/chatbotFaq";
import { faqAnswer, faqQuestion, matchFaq } from "@/lib/chatbotMatch";

type Msg = { from: "bot" | "user"; text: string };

// Лендинговый чат-бот: отвечает ТОЛЬКО по заготовленным текстам (app/content/chatbotFaq.ts, подбор — lib/chatbotMatch.ts),
// без единого обращения к языковой модели или бэкенду — публичный, без авторизации, страница может открыть кто угодно,
// поэтому такой профиль стоимости/злоупотребления сюда не подходит (в отличие от Firmspace AI внутри CRM). Смонтирован
// в Footer, поэтому виден на каждой странице сайта.
export default function Chatbot() {
	const t = useTranslations("chatbot");
	const locale = useLocale();
	const { selectedLanguage } = useLanguageStore();
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const [msgs, setMsgs] = useState<Msg[]>([]);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (open && msgs.length === 0) setMsgs([{ from: "bot", text: t("greeting") }]);
	}, [open, msgs.length, t]);
	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
	}, [msgs, open]);

	function ask(text: string) {
		const clean = text.trim();
		if (!clean) return;
		const hit = matchFaq(clean);
		const reply = hit ? faqAnswer(hit, locale) : t("fallback");
		setMsgs((m) => [...m, { from: "user", text: clean }, { from: "bot", text: reply }]);
		setInput("");
	}

	const quick = CHATBOT_FAQ.slice(0, 3);

	return (
		<div className="fixed bottom-20 right-20 z-50">
			{open && (
				<div role="dialog" aria-label={t("title")} className="mb-14 flex h-[480px] w-[92vw] max-w-[360px] flex-col overflow-hidden rounded-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
					<div className="flex shrink-0 items-center justify-between bg-authBtn px-16 py-14">
						<p className="text-16 font-medium text-white">{t("title")}</p>
						<button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="text-white/80 hover:text-white">
							<MdClose size={20} />
						</button>
					</div>
					<p className="shrink-0 border-b border-[#F0F0F0] bg-[#FFF9EE] px-16 py-8 text-12 leading-[1.5] text-[#8A6A1F]">{t("disclaimer")}</p>

					<div ref={listRef} className="flex-1 space-y-10 overflow-y-auto px-16 py-14">
						{msgs.map((m, i) => (
							<div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
								<p className={`max-w-[85%] whitespace-pre-line rounded-12 px-12 py-8 text-14 leading-[1.5] ${m.from === "user" ? "bg-authBtn text-white" : "bg-gray text-discover"}`}>{m.text}</p>
							</div>
						))}
						{msgs.length <= 1 && (
							<div className="pt-6">
								<p className="mb-8 text-12 text-[#999999]">{t("quickQuestions")}</p>
								<div className="flex flex-col gap-6">
									{quick.map((f) => (
										<button key={f.id} type="button" onClick={() => ask(faqQuestion(f, locale))} className="rounded-8 border border-[#E6E6E6] px-10 py-6 text-left text-13 text-discover transition-colors hover:border-authBtn hover:text-authBtn">
											{faqQuestion(f, locale)}
										</button>
									))}
								</div>
							</div>
						)}
						{msgs.length > 1 && msgs[msgs.length - 1].text === t("fallback") && (
							<p className="text-12 text-[#999999]">
								<Link href={withLocale(selectedLanguage.code, "/support")} className="text-authBtn hover:underline">{t("supportLink")}</Link>
								{" · "}
								<Link href={withLocale(selectedLanguage.code, "/contacts")} className="text-authBtn hover:underline">{t("contactLink")}</Link>
							</p>
						)}
					</div>

					<form
						onSubmit={(e) => { e.preventDefault(); ask(input); }}
						className="flex shrink-0 items-center gap-8 border-t border-[#F0F0F0] p-10">
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(input); } }}
							placeholder={t("placeholder")}
							maxLength={300}
							className="h-[38px] flex-1 rounded-8 border border-[#E6E6E6] px-10 text-14 outline-none focus:border-authBtn"
						/>
						<button type="submit" aria-label={t("send")} className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-8 bg-authBtn text-white transition-opacity hover:opacity-80">
							<MdSend size={18} />
						</button>
					</form>
				</div>
			)}

			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-label={open ? t("close") : t("open")}
				className="ml-auto flex h-[56px] w-[56px] items-center justify-center rounded-[50%] bg-authBtn text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-transform hover:scale-105">
				{open ? <MdClose size={26} /> : <MdChatBubble size={26} />}
			</button>
		</div>
	);
}
