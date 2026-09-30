"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import Modal from "../../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { money } from "../format";
import { serverMessage } from "./model";

// Подключение monobank: токен из кабинета api.monobank.ua проверяется на сервере (GET /personal/client-info),
// затем показываются счета банка с остатками — фирма выбирает, какие завести в CRM. Токен в браузер
// не возвращается: сервер хранит его зашифрованным на счёте (models/BankAccount.ts, providerSecret).

interface BankAccountOption {
	id: string;
	name: string;
	currency: string;
	balance: number;
	ibanTail: string;
}

export default function MonobankDialog({ open, onClose, onLinked }: { open: boolean; onClose: () => void; onLinked: () => void }) {
	const t = useTranslations("finance");
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);
	const [connected, setConnected] = useState<{ name: string; accounts: BankAccountOption[] } | null>(null);
	const [notice, setNotice] = useState("");

	async function check() {
		if (!token.trim() || busy) return;
		setBusy(true);
		setNotice("");
		const r = await apiCall<{ name: string; accounts: BankAccountOption[] }>("/api/bank/monobank", "POST", { action: "connect", token: token.trim() });
		setBusy(false);
		if (!r.ok || !r.data) { setNotice(serverMessage(t, r.message)); return; }
		setConnected({ name: r.data.name, accounts: r.data.accounts });
	}

	async function link(accountId: string) {
		setBusy(true);
		setNotice("");
		const r = await apiCall<{ id: string }>("/api/bank/monobank", "POST", { action: "link", token: token.trim(), providerAccountId: accountId });
		setBusy(false);
		if (!r.ok) { setNotice(serverMessage(t, r.message)); return; }
		toast.success(t("mbLinked"));
		onLinked();
		onClose();
		setToken("");
		setConnected(null);
	}

	function close() {
		onClose();
		setNotice("");
		setConnected(null);
	}

	const label = "mb-6 block text-12 text-[#8c948b]";

	return (
		<Modal open={open} onClose={close} label={t("mbTitle")} className="w-full max-w-[520px]">
			<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
				<h2 className="mb-12 text-16 font-semibold text-[#f1f4ee]">{t("mbTitle")}</h2>
				<p className="mb-14 text-12 leading-[1.6] text-[#8c948b]">{t("mbHint")}</p>
				<label className="block">
					<span className={label}>{t("mbToken")}</span>
					<input
						value={token}
						onChange={(e) => { setToken(e.target.value); setConnected(null); }}
						placeholder="uXXXXXXXXXXXXXXXXXXXXXXXXX"
						className="fs-field h-40 w-full px-12 font-mono text-12 outline-none"
						autoComplete="off"
					/>
				</label>
				{!connected && (
					<div className="mt-14 flex items-center gap-10">
						<button type="button" disabled={busy || !token.trim()} onClick={() => void check()} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">
							{busy ? t("mbChecking") : t("mbCheck")}
						</button>
						<a href="https://api.monobank.ua" target="_blank" rel="noreferrer" className="fs-link text-12">{t("mbWhere")}</a>
					</div>
				)}
				{connected && (
					<div className="mt-14">
						<p className="mb-10 text-13 text-[#cfd4cb]">{t("mbConnectedAs", { name: connected.name || "monobank" })}</p>
						{connected.accounts.length === 0 ? (
							<p className="text-12 text-[#F4A100]">{t("mbNoAccounts")}</p>
						) : (
							<ul className="flex flex-col gap-8">
								{connected.accounts.map((a) => (
									<li key={a.id} className="flex flex-wrap items-center justify-between gap-10 rounded-10 border border-inkLine px-12 py-10">
										<span className="min-w-0 text-13 text-[#f1f4ee]">
											{a.name}
											{a.ibanTail && <span className="ml-8 text-11 text-[#9AA396]">…{a.ibanTail}</span>}
										</span>
										<span className="flex items-center gap-10">
											<span className="text-12 text-[#8c948b]">{money(a.balance, a.currency || "UAH", "uk")}</span>
											<button type="button" disabled={busy} onClick={() => void link(a.id)} className="fs-btn fs-btn-ghost h-32 text-12 disabled:opacity-[0.5]">
												{t("mbAdd")}
											</button>
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
				{notice && <p className="mt-12 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
				<div className="mt-18 flex justify-end">
					<button type="button" onClick={close} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
				</div>
			</div>
		</Modal>
	);
}
