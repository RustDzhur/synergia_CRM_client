"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import Modal from "../../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { money } from "../format";
import { serverMessage } from "./model";

// Подключение банка по API: monobank (токен, счета подтягиваются списком) и ПриватБанк
// (пара id + token из кабинета «Автоклієнт» и IBAN счёта). Ключи проверяются на сервере до
// сохранения, хранятся зашифрованными (models/BankAccount.ts, providerSecret) и в браузер
// не возвращаются — интерфейс видит только имя счёта и хвост номера.

type Provider = "monobank" | "privatbank";

interface BankAccountOption {
	id: string;
	name: string;
	currency: string;
	balance: number;
	ibanTail: string;
}

export default function BankConnectDialog({ open, onClose, onLinked }: { open: boolean; onClose: () => void; onLinked: () => void }) {
	const t = useTranslations("finance");
	const [provider, setProvider] = useState<Provider>("monobank");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");

	// monobank: проверка токена и список счетов
	const [token, setToken] = useState("");
	const [connected, setConnected] = useState<{ name: string; accounts: BankAccountOption[] } | null>(null);

	// ПриватБанк: id + token + IBAN
	const [pb, setPb] = useState({ id: "", token: "", iban: "", name: "" });

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
		close();
	}

	async function linkPrivat() {
		if (busy) return;
		setBusy(true);
		setNotice("");
		const r = await apiCall<{ name: string }>("/api/bank/privatbank", "POST", { action: "link", id: pb.id.trim(), token: pb.token.trim(), iban: pb.iban.trim(), name: pb.name.trim() });
		setBusy(false);
		if (!r.ok) { setNotice(serverMessage(t, r.message)); return; }
		toast.success(t("pbLinked", { name: r.data?.name ?? "ПриватБанк" }));
		onLinked();
		close();
	}

	function close() {
		onClose();
		setNotice("");
		setConnected(null);
	}

	const label = "mb-6 block text-12 text-[#8c948b]";
	const tab = (id: Provider, caption: string) => (
		<button
			key={id}
			type="button"
			onClick={() => { setProvider(id); setNotice(""); }}
			className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${provider === id ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
			{caption}
		</button>
	);

	return (
		<Modal open={open} onClose={close} label={t("bankConnect")} className="w-full max-w-[560px]">
			<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
				<h2 className="mb-12 text-16 font-semibold text-[#f1f4ee]">{t("bankConnect")}</h2>
				<div className="mb-14 flex flex-wrap gap-8">
					{tab("monobank", "monobank")}
					{tab("privatbank", t("pbTab"))}
				</div>

				{provider === "monobank" && (
					<>
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
					</>
				)}

				{provider === "privatbank" && (
					<>
						<p className="mb-14 text-12 leading-[1.6] text-[#8c948b]">{t("pbHint")}</p>
						<div className="flex flex-col gap-12">
							<label className="block">
								<span className={label}>{t("pbId")}</span>
								<input value={pb.id} onChange={(e) => setPb({ ...pb, id: e.target.value })} placeholder="12345678" className="fs-field h-40 w-full px-12 font-mono text-12 outline-none" autoComplete="off" />
							</label>
							<label className="block">
								<span className={label}>{t("pbToken")}</span>
								<input value={pb.token} onChange={(e) => setPb({ ...pb, token: e.target.value })} placeholder="aXXXXXXXXXXXXXXXXXXXXX" className="fs-field h-40 w-full px-12 font-mono text-12 outline-none" autoComplete="off" />
							</label>
							<label className="block">
								<span className={label}>{t("pbIban")}</span>
								<input value={pb.iban} onChange={(e) => setPb({ ...pb, iban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 29) })} placeholder="UA…" className="fs-field h-40 w-full px-12 font-mono text-12 outline-none" autoComplete="off" />
							</label>
							<label className="block">
								<span className={label}>{t("pbName")}</span>
								<input value={pb.name} onChange={(e) => setPb({ ...pb, name: e.target.value })} className="fs-field h-40 w-full px-12 text-13 outline-none" maxLength={80} />
							</label>
						</div>
						<div className="mt-14 flex items-center gap-10">
							<button type="button" disabled={busy || !pb.id.trim() || !pb.token.trim() || !/^UA\d{27}$/.test(pb.iban)} onClick={() => void linkPrivat()} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">
								{busy ? t("pbChecking") : t("pbConnect")}
							</button>
							<span className="text-11 text-[#9AA396]">{t("pbWhere")}</span>
						</div>
					</>
				)}

				{notice && <p className="mt-12 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
				<div className="mt-18 flex justify-end">
					<button type="button" onClick={close} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
				</div>
			</div>
		</Modal>
	);
}
