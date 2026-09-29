"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbArrowLeft, TbBuildingBank, TbCash, TbCheck, TbPlus, TbTrash, TbUpload } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { balanceAt, suggestMatches } from "@/lib/finance/bank";
import type { MatchCandidate, MatchSuggestion } from "@/lib/finance/bank";
import { periodRange } from "@/lib/finance/reportMath";
import type { PeriodKind } from "@/lib/finance/reportMath";
import ConfirmDialog from "../shared/ConfirmDialog";
import { PeriodSwitch, ReportLoading, Stat } from "./reportParts";
import { money } from "./format";
import AccountCards from "./bankParts/AccountCards";
import AccountDialog from "./bankParts/AccountDialog";
import ManualDialog from "./bankParts/ManualDialog";
import MatchDialog from "./bankParts/MatchDialog";
import TransactionsTable from "./bankParts/TransactionsTable";
import { EMPTY_ACCOUNT, EMPTY_MANUAL, amountColor, buildCandidates, dayGap, serverMessage } from "./bankParts/model";
import type { BankAccountRow, BankTx, ImportResult } from "./bankParts/model";

// Bank und Kassenbuch — счета в банке и кассы: остаток, движения и сверка.
//
// Экран двухуровневый: сначала обзор счетов (карточки с сальдо и числом несверенных движений), затем
// движения выбранного счёта с периодом, импортом выписки, ручным вводом (для кассы это основной способ
// ведения книги) и сверкой со счетами клиентам и расходами. Таблица, карточки и окна лежат в bankParts/,
// здесь — состояние и обращения к серверу.
//
// Сервер (app/api/bank/*) считает сальдо, отсекает дубликаты при повторном импорте и подбирает
// пары к строкам выписки; клиент показывает это и даёт человеку принять решение. Разбор выписки
// (lib/finance/bank.ts) чистый — без mongoose — поэтому его можно звать и здесь, чтобы отсортировать
// кандидатов на сверку так же, как это сделал импорт.

// Экран вкладки «Bank» раздела Finance — открывается и по ссылке ?tab=bank (см. index.tsx)
export default function Bank() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const invoices = useFinanceStore((s) => s.invoices);
	const expenses = useFinanceStore((s) => s.expenses);
	const loadInvoices = useFinanceStore((s) => s.loadInvoices);
	const loadExpenses = useFinanceStore((s) => s.loadExpenses);

	const [accounts, setAccounts] = useState<BankAccountRow[] | null>(null);
	const [accountsFailed, setAccountsFailed] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [period, setPeriod] = useState<PeriodKind>("quarter");
	const [onlyUnmatched, setOnlyUnmatched] = useState(false);
	const [rows, setRows] = useState<BankTx[] | null>(null);
	// Полный список за период (без фильтра «только несверенные») — по нему считается сальдо,
	// иначе включённый фильтр обнулял бы остаток на экране.
	const [fullRows, setFullRows] = useState<BankTx[] | null>(null);
	const [rowsFailed, setRowsFailed] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);

	const [accountOpen, setAccountOpen] = useState(false);
	const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
	const [manualOpen, setManualOpen] = useState(false);
	const [manualForm, setManualForm] = useState(EMPTY_MANUAL);
	// движение, выбранное для сверки, и открытость окна — отдельно, чтобы содержимое не мигало
	// при плавном закрытии (Modal размонтирует детей после анимации, как в Assets.tsx)
	const [matchTx, setMatchTx] = useState<BankTx | null>(null);
	const [matchOpen, setMatchOpen] = useState(false);
	const [toDelete, setToDelete] = useState<BankTx | null>(null);
	const [clearOpen, setClearOpen] = useState(false);
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	const [importBusy, setImportBusy] = useState(false);
	const [importNotice, setImportNotice] = useState("");
	const [importResult, setImportResult] = useState<ImportResult | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);
	// список счетов уже хоть раз показан: сбой повторной загрузки тогда не стирает экран, а уходит в тост
	const accountsLoadedRef = useRef(false);

	const range = useMemo(() => periodRange(period), [period]);
	const account = accounts?.find((a) => a.id === selectedId) ?? null;

	// Справочники для сверки (открытые счета клиентам и расходы) берём из общего стора Finance,
	// чтобы не заводить второй список документов на этом экране
	useEffect(() => { loadInvoices(); loadExpenses(); }, [loadInvoices, loadExpenses]);

	// Счета и кассы с остатком и числом несверенных движений
	useEffect(() => {
		let alive = true;
		apiCall<{ accounts: BankAccountRow[] }>("/api/bank/accounts", "GET", undefined, { cache: "no-store" }).then((r) => {
			if (!alive) return;
			if (r.ok && r.data) {
				accountsLoadedRef.current = true;
				setAccounts(r.data.accounts);
				setAccountsFailed(false);
				return;
			}
			if (accountsLoadedRef.current) { toast.error(t("bankLoadFailed")); return; }
			setAccountsFailed(true);
		});
		return () => { alive = false; };
	}, [reloadKey, t]);

	// Движения счёта за период. Фильтр «только несверенные» — это unmatched=1 у сервера;
	// полный список запрашиваем тем же запросом только когда фильтр включён (иначе это тот же ответ).
	useEffect(() => {
		if (!selectedId) return;
		let alive = true;
		const { from, to } = periodRange(period);
		const base = `/api/bank/transactions?account=${selectedId}&from=${from}&to=${to}`;
		const full = apiCall<{ transactions: BankTx[] }>(base, "GET", undefined, { cache: "no-store" });
		const shown = onlyUnmatched ? apiCall<{ transactions: BankTx[] }>(`${base}&unmatched=1`, "GET", undefined, { cache: "no-store" }) : full;
		Promise.all([full, shown]).then(([f, s]) => {
			if (!alive) return;
			setFullRows(f.ok && f.data ? f.data.transactions : null);
			setRows(s.ok && s.data ? s.data.transactions : null);
			setRowsFailed(!(s.ok && s.data));
		});
		return () => { alive = false; };
	}, [selectedId, period, onlyUnmatched, reloadKey]);

	function reload() { setReloadKey((k) => k + 1); }

	function openAccount(id: string) {
		setNotice("");
		setImportNotice("");
		setImportResult(null);
		setOnlyUnmatched(false);
		// строки прошлого счёта не показываем под новым именем, пока не придёт ответ сервера
		setRows(null);
		setFullRows(null);
		setSelectedId(id);
	}

	const message = (text: string) => serverMessage(t, text);

	// Подпись привязанного документа: счёт клиенту или расход, найденные в сторе по matchId.
	// Если документ ещё не загружен, показываем хотя бы тип привязки.
	function linkedLabel(tx: BankTx): string {
		if (tx.matchType === "invoice") {
			const inv = invoices.find((i) => i.id === tx.matchId);
			return inv ? `${t("bankMatchInvoice")} · ${inv.number}` : t("bankMatchInvoice");
		}
		if (tx.matchType === "expense") {
			const ex = expenses.find((e) => e.id === tx.matchId);
			return ex ? `${t("bankMatchExpense")} · ${ex.vendor}` : t("bankMatchExpense");
		}
		return t("bankMatchManual");
	}

	// Кандидаты для открытого движения: подсказка того же вида, что делает импорт (suggestMatches),
	// идёт первой, дальше — совпадение по сумме, затем по близости даты
	const candidates = useMemo(() => {
		if (!matchTx) return { list: [] as MatchCandidate[], hint: null as MatchSuggestion | null };
		const list = buildCandidates(matchTx, invoices, expenses);
		const hint = suggestMatches(
			[{ index: 0, amount: matchTx.amount, date: matchTx.date, reference: matchTx.reference, counterparty: matchTx.counterparty }],
			list
		)[0] ?? null;
		const rank = (c: MatchCandidate) => {
			let s = dayGap(c.date, matchTx.date);
			if (hint && hint.candidateId === c.id) s -= 1000;
			else if (Math.abs(c.amount - matchTx.amount) < 0.01) s -= 100;
			return s;
		};
		return { list: [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 50), hint };
	}, [matchTx, invoices, expenses]);

	const movementSum = (fullRows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
	const balance = account ? balanceAt(account.openingBalance, fullRows ?? [], range.to) : 0;
	const hasImported = (fullRows ?? []).some((r) => r.source === "import");

	function openNewAccount() {
		setNotice("");
		setAccountForm(EMPTY_ACCOUNT);
		setAccountOpen(true);
	}

	function openManual() {
		setNotice("");
		setManualForm(EMPTY_MANUAL);
		setManualOpen(true);
	}

	async function createAccount(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setNotice("");
		setBusy(true);
		const r = await apiCall<{ id: string }>("/api/bank/accounts", "POST", {
			name: accountForm.name.trim(),
			kind: accountForm.kind,
			iban: accountForm.iban.trim(),
			bic: accountForm.bic.trim(),
			openingBalance: Number(accountForm.openingBalance) || 0,
			openingDate: accountForm.openingDate,
		});
		setBusy(false);
		if (!r.ok) {
			// Отказ (400) — это объяснение, а не поломка: спокойная строка в форме вместо красного тоста
			setNotice(message(r.message));
			return;
		}
		toast.success(t("saved"));
		setAccountOpen(false);
		reload();
	}

	async function submitManual(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedId || busy) return;
		setNotice("");
		const amount = Number(manualForm.amount);
		if (!manualForm.date) { setNotice(t("bankErrDate")); return; }
		if (!Number.isFinite(amount) || amount === 0) { setNotice(t("bankErrAmount")); return; }
		setBusy(true);
		const r = await apiCall<BankTx>("/api/bank/transactions", "POST", {
			account: selectedId,
			date: manualForm.date,
			amount,
			counterparty: manualForm.counterparty.trim(),
			reference: manualForm.reference.trim(),
			notes: manualForm.notes.trim(),
		});
		setBusy(false);
		if (!r.ok) { setNotice(message(r.message)); return; }
		toast.success(t("saved"));
		setManualOpen(false);
		reload();
	}

	// Импорт выписки: файл читает браузер (FileReader), на сервер уходит уже текст CSV —
	// он же отсекает дубликаты по внешнему идентификатору и подбирает пары к строкам
	function importFile(file: File) {
		if (!selectedId || importBusy) return;
		setImportBusy(true);
		setImportNotice("");
		setImportResult(null);
		const reader = new FileReader();
		reader.onload = async () => {
			const csv = typeof reader.result === "string" ? reader.result : "";
			const r = await apiCall<ImportResult>("/api/bank/transactions", "POST", { account: selectedId, csv });
			setImportBusy(false);
			if (fileRef.current) fileRef.current.value = "";
			if (!r.ok || !r.data) { setImportNotice(message(r.message)); return; }
			setImportResult(r.data);
			reload();
		};
		reader.onerror = () => {
			setImportBusy(false);
			if (fileRef.current) fileRef.current.value = "";
			setImportNotice(t("bankImportFailed"));
		};
		reader.readAsText(file);
	}

	// Сверка: привязываем движение к счёту клиенту или расходу (PATCH) либо снимаем привязку
	async function match(tx: BankTx, candidateId: string) {
		if (busy) return;
		setNotice("");
		setBusy(true);
		const r = await apiCall<BankTx>("/api/bank/transactions", "PATCH", {
			id: tx.id,
			matchType: tx.amount > 0 ? "invoice" : "expense",
			matchId: candidateId,
		});
		setBusy(false);
		if (!r.ok) { setNotice(message(r.message)); return; }
		toast.success(t("bankMatched"));
		setMatchOpen(false);
		reload();
	}

	async function unlink(tx: BankTx) {
		const r = await apiCall<BankTx>("/api/bank/transactions", "PATCH", { id: tx.id, matchType: "" });
		if (!r.ok) { toast.error(message(r.message)); return; }
		toast.success(t("bankUnlinked"));
		reload();
	}

	async function remove(tx: BankTx) {
		const r = await apiCall(`/api/bank/transactions?id=${tx.id}`, "DELETE");
		if (!r.ok) { toast.error(message(r.message)); return; }
		reload();
	}

	// Чистка ошибочного импорта: сервер удаляет только движения источника «import»,
	// вручную введённые и уже сверенные записи остаются
	async function clearImported() {
		if (!selectedId) return;
		const r = await apiCall<{ removed: number }>(`/api/bank/transactions?account=${selectedId}&all=1`, "DELETE");
		if (!r.ok || !r.data) { toast.error(message(r.message)); return; }
		toast.success(t("bankCleared", { count: r.data.removed ?? 0 }));
		reload();
	}

	return (
		<div>
			{account ? (
				<>
					<button
						type="button"
						onClick={() => { setSelectedId(null); setRows(null); setFullRows(null); setNotice(""); setImportNotice(""); setImportResult(null); }}
						className="fs-link mb-14">
						<TbArrowLeft size={15} aria-hidden /> {t("bankBack")}
					</button>

					<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
						<div className="flex min-w-0 flex-wrap items-center gap-x-10 gap-y-6">
							<h2 className="text-16 font-semibold text-[#f1f4ee]">{account.name}</h2>
							<span className={`fs-chip ${account.kind === "cash" ? "border-[rgba(244,161,0,0.35)] text-[#F4A100]" : ""}`}>
								{account.kind === "cash" ? <TbCash size={14} aria-hidden /> : <TbBuildingBank size={14} aria-hidden />}
								{account.kind === "cash" ? t("bankKindCash") : t("bankKindBank")}
							</span>
							{account.iban && <span className="text-12 text-[#8c948b]">{account.iban}</span>}
						</div>
						<PeriodSwitch value={period} onChange={setPeriod} />
					</div>

					{/* Сальдо — остаток на начало плюс движения за период: balanceAt из lib/finance/bank.ts
					    (та же формула, что у сервера, поэтому цифры сходятся с обзором счетов) */}
					<div className="mb-16 grid grid-cols-2 gap-12 md:grid-cols-3">
						<Stat label={t("bankOpeningBalance")} value={money(account.openingBalance, account.currency, locale)} />
						{/* до ответа сервера цифры не показываем: ноль на месте сальдо читался бы как факт */}
						<Stat label={t("bankPeriodMovements")} value={fullRows === null ? "—" : money(movementSum, account.currency, locale)} color={fullRows === null ? undefined : amountColor(movementSum)} />
						<Stat label={t("bankBalanceEnd", { date: range.to })} value={fullRows === null ? "—" : money(balance, account.currency, locale)} color={fullRows === null ? undefined : amountColor(balance)} />
					</div>

					<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
						{/* «Unvollständig» в интерфейсе — ровно движения без привязки: unmatched=1 у сервера */}
						<button
							type="button"
							aria-pressed={onlyUnmatched}
							onClick={() => setOnlyUnmatched((v) => !v)}
							className={`fs-chip h-34 px-14 transition-colors ${onlyUnmatched ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "text-[#9AA396] hover:text-[#f1f4ee]"}`}>
							{onlyUnmatched && <TbCheck size={14} aria-hidden />}
							{t("bankOnlyUnmatched")}
						</button>
						<div className="flex flex-wrap items-center gap-x-16 gap-y-10">
							<span className="text-12 text-[#9AA396]">{t("periodLabel")}: {range.from} – {range.to}</span>
							<input
								ref={fileRef}
								type="file"
								accept=".csv,text/csv"
								hidden
								onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }}
								aria-label={t("bankImport")}
							/>
							{/* У кассы основной способ — ручная запись (это и есть Kassenbuch), у банка — импорт выписки;
							    главную кнопку поэтому меняем местами по виду счёта */}
							<button
								type="button"
								disabled={importBusy}
								title={t("bankImportHint")}
								onClick={() => fileRef.current?.click()}
								className={`fs-btn h-40 disabled:opacity-[0.5] ${account.kind === "cash" ? "fs-btn-ghost" : "fs-btn-primary"}`}>
								<TbUpload size={16} /> {importBusy ? t("bankImportBusy") : t("bankImport")}
							</button>
							<button
								type="button"
								onClick={openManual}
								className={`fs-btn h-40 ${account.kind === "cash" ? "fs-btn-primary" : "fs-btn-ghost"}`}>
								<TbPlus size={16} /> {t("bankAddMovement")}
							</button>
						</div>
					</div>

					{/* Итог импорта: сколько строк принято, сколько пропущено и сколько пар подсказал сервер */}
					{importResult && (
						<p className="mb-16 rounded-10 border border-[rgba(198,255,77,0.22)] bg-[rgba(198,255,77,0.06)] px-12 py-8 text-12 leading-[1.5] text-[#cfd4cb]">
							{t("bankImportDone", { imported: importResult.imported, skipped: importResult.skipped, suggestions: importResult.suggestions })}
						</p>
					)}
					{importNotice && <p className="mb-16 text-12 leading-[1.5] text-[#F4A100]">{importNotice}</p>}

					{rows === null ? (
						rowsFailed ? <p className="fs-card p-30 text-center text-13 text-[#F4A100]">{t("bankLoadFailed")}</p> : <ReportLoading />
					) : rows.length === 0 ? (
						<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{onlyUnmatched ? t("bankAllMatched") : t("bankNoMovements")}</p>
					) : (
						<TransactionsTable
							rows={rows}
							linkedLabel={linkedLabel}
							onMatch={(tx) => { setNotice(""); setMatchTx(tx); setMatchOpen(true); }}
							onUnlink={unlink}
							onDelete={setToDelete}
						/>
					)}

					<div className="mt-10 flex flex-wrap items-center justify-between gap-x-16 gap-y-10">
						<p className="text-12 text-[#9AA396]">{rows === null ? "—" : t("bankShownCount", { count: rows.length })}</p>
						{hasImported && (
							<button type="button" onClick={() => setClearOpen(true)} className="fs-btn fs-btn-ghost h-36 text-[#9AA396] hover:text-danger">
								<TbTrash size={15} /> {t("bankClearImported")}
							</button>
						)}
					</div>
				</>
			) : (
				<>
					<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
						<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("bankTitle")}</h2>
						<button type="button" onClick={openNewAccount} className="fs-btn fs-btn-primary h-40">
							<TbPlus size={16} /> {t("bankNewAccount")}
						</button>
					</div>
					<p className="mb-16 text-12 leading-[1.5] text-[#8c948b]">{t("bankHint")}</p>
					<p className="fs-eyebrow mb-10">{t("bankAccounts")}</p>

					{accounts === null ? (
						accountsFailed ? <p className="fs-card p-30 text-center text-13 text-[#F4A100]">{t("bankLoadFailed")}</p> : <ReportLoading />
					) : accounts.length === 0 ? (
						<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("bankEmpty")}</p>
					) : (
						<AccountCards accounts={accounts} onOpen={openAccount} />
					)}
				</>
			)}

			<AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} form={accountForm} onChange={setAccountForm} notice={notice} busy={busy} onSubmit={createAccount} />
			<ManualDialog open={manualOpen} onClose={() => setManualOpen(false)} form={manualForm} onChange={setManualForm} notice={notice} busy={busy} onSubmit={submitManual} />
			<MatchDialog open={matchOpen} onClose={() => setMatchOpen(false)} tx={matchTx} candidates={candidates} notice={notice} busy={busy} onPick={match} />

			<ConfirmDialog
				open={!!toDelete}
				title={t("delete")}
				text={t("bankConfirmDeleteTx")}
				onCancel={() => setToDelete(null)}
				onConfirm={() => { if (toDelete) remove(toDelete); setToDelete(null); }}
			/>

			<ConfirmDialog
				open={clearOpen}
				title={t("bankClearImported")}
				text={t("bankConfirmClear")}
				onCancel={() => setClearOpen(false)}
				onConfirm={() => { clearImported(); setClearOpen(false); }}
			/>
		</div>
	);
}
