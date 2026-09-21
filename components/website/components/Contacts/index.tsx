"use client";
import React, { useState } from "react";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { CONTACT } from "@/app/content/sitePages";

const field = "block w-full rounded-4 border-2 border-[#999999] bg-white px-12 text-16 text-[#4D4D4D] outline-none placeholder:text-[#B3B3B3] transition-colors focus:border-primaryColor";

// Contact: слева тёмная карточка с розовым кругом, справа форма. Форма отправляет обращение на /api/contact.
export default function ContactsPage() {
	const locale = useLocale();
	const [values, setValues] = useState({ name: "", email: "", phone: "", message: "" });
	const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
	const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [k]: e.target.value });

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (state === "sending") return;
		setState("sending");
		try {
			const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, locale }) });
			if (!res.ok) throw new Error();
			setValues({ name: "", email: "", phone: "", message: "" });
			setState("sent");
		} catch {
			setState("error");
		}
	}

	return (
		<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 md:px-20 lg:px-100 sm:pb-50 lg:pb-[100px]">
			<div className="flex flex-col gap-30 md:flex-row md:gap-[40px] lg:gap-[40px]">
				<div className="relative overflow-hidden rounded-16 bg-aboutUsBackground px-24 pt-24 pb-[220px] text-center text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] md:w-[45%] lg:w-[504px] lg:h-[605px] lg:shrink-0">
					<h1 className="text-32 lg:text-36 font-medium tracking-[1px] leading-[1.3]">{tx(CONTACT.title, locale)}</h1>
					<p className="mt-8 text-16 lg:text-20 font-medium tracking-[0.4px]">{tx(CONTACT.subtitle, locale)}</p>
					<ul className="relative z-10 mt-30 space-y-16 text-left text-16 tracking-[0.3px]">
						{CONTACT.details.map((d) => (
							<li key={d.value}>
								<span className="block text-14 text-[#B3B3B3]">{tx(d.label, locale)}</span>
								{d.value}
							</li>
						))}
					</ul>
					<div className="absolute -bottom-[10px] -right-[10px] h-[300px] w-[300px] rounded-[50%] bg-[#E91E9B] lg:h-[360px] lg:w-[360px] lg:-bottom-[40px] lg:-right-[30px]" aria-hidden />
				</div>

				<form onSubmit={submit} className="flex-1 lg:max-w-[400px]">
					<label className="mb-16 block">
						<span className="mb-8 block text-16 lg:text-18 font-medium text-discover">{tx(CONTACT.name, locale)}</span>
						<input value={values.name} onChange={set("name")} placeholder={tx(CONTACT.namePh, locale)} maxLength={100} required className={`${field} h-[47px]`} />
					</label>
					<label className="mb-16 block">
						<span className="mb-8 block text-16 lg:text-18 font-medium text-discover">{tx(CONTACT.email, locale)}</span>
						<input type="email" value={values.email} onChange={set("email")} placeholder={tx(CONTACT.emailPh, locale)} maxLength={200} required className={`${field} h-[47px]`} />
					</label>
					<label className="mb-16 block">
						<span className="mb-8 block text-16 lg:text-18 font-medium text-discover">{tx(CONTACT.phone, locale)}</span>
						<input type="tel" value={values.phone} onChange={set("phone")} placeholder={tx(CONTACT.phonePh, locale)} maxLength={40} className={`${field} h-[47px]`} />
					</label>
					<label className="mb-30 block">
						<span className="mb-8 block text-16 lg:text-18 font-medium text-discover">{tx(CONTACT.message, locale)}</span>
						<textarea value={values.message} onChange={set("message")} placeholder={tx(CONTACT.messagePh, locale)} maxLength={3000} required rows={6} className={`${field} py-12 resize-none lg:h-[137px]`} />
					</label>
					<div className="flex flex-col items-end gap-12">
						<button type="submit" disabled={state === "sending"} className="h-[52px] rounded-4 bg-authBtn px-[30px] text-18 font-medium tracking-[0.4px] text-white transition-opacity hover:opacity-80 disabled:opacity-60">
							{tx(state === "sending" ? CONTACT.sending : CONTACT.send, locale)}
						</button>
						{state === "sent" && <p role="status" className="self-stretch text-14 text-[#009A2B]">{tx(CONTACT.sent, locale)}</p>}
						{state === "error" && <p role="alert" className="self-stretch text-14 text-danger">{tx(CONTACT.failed, locale)}</p>}
					</div>
				</form>
			</div>
		</div>
	);
}
