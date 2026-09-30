"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy, TbExternalLink } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import Modal from "../../shared/Modal";

// Ссылка на оплату счёта: выбираем, через какую кассу фирмы принять деньги, и куда отправить ссылку —
// клиенту в его переписку (Telegram, Viber, WhatsApp) или просто копируем. Когда клиент оплатит,
// провайдер сам позовёт наш вебхук, и счёт закроется без участия менеджера.

interface Options {
	providers: string[];
	conversations: { id: string; channel: string; name: string }[];
	payLink: { provider: string; url: string } | null;
}

const PROVIDER_LABEL: Record<string, string> = { monobank: "monobank", liqpay: "LiqPay", wayforpay: "WayForPay", cryptopay: "Crypto" };

export default function PaymentLinkDialog({ invoiceId, open, onClose, onCreated }: { invoiceId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [options, setOptions] = useState<Options | null>(null);
	const [provider, setProvider] = useState("");
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setOptions(null);
		setUrl("");
		void apiCall<Options>(`/api/invoices/${invoiceId}/payment-link`).then((res) => {
			if (!res.ok || !res.data) return;
			setOptions(res.data);
			setProvider(res.data.providers[0] ?? "");
			if (res.data.payLink) setUrl(res.data.payLink.url);
		});
	}, [open, invoiceId]);

	async function create(conversationId?: string) {
		if (!provider || busy) return;
		setBusy(true);
		const res = await apiCall<{ url: string; sent: boolean; sendError: string }>(`/api/invoices/${invoiceId}/payment-link`, "POST", { provider, conversationId, locale });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setUrl(res.data.url);
		onCreated();
		if (conversationId) {
			if (res.data.sent) toast.success(t("payLinkSent"));
			else toast.error(res.data.sendError || t("payLinkSendFailed"));
		} else {
			toast.success(t("payLinkReady"));
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(t("payLinkCopied"));
		} catch {
			toast.error(t("payLinkCopyFailed"));
		}
	}

	return (
		<Modal open={open} onClose={onClose} label={t("payLinkTitle")} className="w-full max-w-[520px]">
			<div className="fs-popover p-20">
				<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{t("payLinkTitle")}</h2>
				<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("payLinkHelp")}</p>

				{!options ? (
					<p className="text-13 text-[#8c948b]">…</p>
				) : options.providers.length === 0 ? (
					<p className="rounded-10 border border-[rgba(244,161,0,0.3)] bg-[rgba(244,161,0,0.08)] p-12 text-12 text-[#F4A100]">{t("payLinkNoProvider")}</p>
				) : (
					<>
						<p className="mb-6 text-12 text-[#8c948b]">{t("payLinkProvider")}</p>
						<div className="mb-14 flex flex-wrap gap-8">
							{options.providers.map((p) => (
								<button
									key={p}
									type="button"
									onClick={() => { setProvider(p); setUrl(""); }}
									className={`fs-btn h-34 px-14 text-13 ${provider === p ? "fs-btn-primary" : "fs-btn-ghost"}`}>
									{PROVIDER_LABEL[p] ?? p}
								</button>
							))}
						</div>
						{!url && <button type="button" onClick={() => void create()} disabled={busy} className="fs-btn fs-btn-primary h-38 disabled:opacity-60">{busy ? "…" : t("payLinkCreate")}</button>}
					</>
				)}

				{url && (
					<>
						<div className="flex items-center gap-8 rounded-10 border border-inkLineSoft bg-[rgba(255,255,255,0.02)] p-10">
							<span className="min-w-0 flex-1 truncate text-12 text-[#f1f4ee]">{url}</span>
							<button type="button" onClick={() => void copy()} title={t("payLinkCopy")} aria-label={t("payLinkCopy")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]"><TbCopy size={16} /></button>
							<a href={url} target="_blank" rel="noopener noreferrer" title={t("openInGoogle")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]"><TbExternalLink size={16} /></a>
						</div>
						{options && options.conversations.length > 0 && (
							<>
								<p className="mb-6 mt-14 text-12 text-[#8c948b]">{t("payLinkSend")}</p>
								<div className="flex flex-wrap gap-8">
									{options.conversations.map((c) => (
										<button key={c.id} type="button" onClick={() => void create(c.id)} disabled={busy} className="fs-btn fs-btn-ghost h-34 text-13 disabled:opacity-60">
											{c.channel} · {c.name}
										</button>
									))}
								</div>
							</>
						)}
					</>
				)}
			</div>
		</Modal>
	);
}
