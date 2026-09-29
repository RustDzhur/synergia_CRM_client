"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
	TbArrowLeft,
	TbBuildingBank,
	TbCash,
	TbCheck,
	TbLink,
	TbLinkOff,
	TbPlus,
	TbReceipt,
	TbTrash,
	TbUpload,
} from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import type { Expense, Invoice } from "@/store/useFinanceStore";
import { balanceAt, suggestMatches } from "@/lib/finance/bank";
import type { MatchCandidate, MatchSuggestion } from "@/lib/finance/bank";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { PeriodSwitch, ReportLoading } from "./reportParts";
import type { PeriodKind } from "@/lib/finance/reports";
import { money } from "./format";

// Bank und Kassenbuch — счета в банке и кассы: остаток, движения и сверка.
//
// Экран двухуровневый и живёт в одном файле: сначала обзор счетов (карточки с сальдо и числом
// несверенных движений), затем движения выбранного счёта с периодом, импортом выписки, ручным
// вводом (для кассы это основной способ ведения книги) и сверкой со счетами клиентам и расходами.
//
// Сервер (app/api/bank/*) считает сальдо, отсекает дубликаты при повторном импорте и подбирает
// пары к строкам выписки; клиент показывает это и даёт человеку принять решение. Разбор выписки
// (lib/finance/bank.ts) чистый — без mongoose — поэтому его можно звать и здесь, чтобы отсортировать
// кандидатов на сверку так же, как это сделал импорт.

type Kind = "bank" | "cash";
type TxMatchType = "" | "invoice" | "expense" | "manual";

interface BankAccountRow {
	id: string;
	kind: Kind;
	name: string;
	iban: string;
	currency: string;
	openingBalance: number;
	openingDate: string;
	active: boolean;
	balance: number;
	transactionCount: number;
	unmatched: number;
}

// Движение в том виде, в каком его отдаёт toDTO (app/api/bank/transactions/route.ts)
interface BankTx {
	id: string;
	account: string;
	date: string;
	amount: number;
	currency: string;
	counterparty: string;
	reference: string;
	matchType: TxMatchType;
	matchId: string;
	source: "import" | "manual" | "auto";
	notes: string;
}

interface ImportResult {
	imported: number;
	skipped: number;
	suggestions: number;
	transactions: BankTx[];
}

const today = () => new Date().toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const EMPTY_ACCOUNT = { name: "", kind: "bank" as Kind, iban: "", bic: "", openingBalance: "", openingDate: today() };
const EMPTY_MANUAL = { date: today(), amount: "", counterparty: "", reference: "", notes: "" };

// Границы периода (месяц/квартал/год) — та же формула, что в lib/finance/reports.ts; модуль тянет
// mongoose, на клиент его импортировать нельзя, поэтому расчёт повторён здесь (как в Assets.tsx).
function periodRange(kind: PeriodKind): { from: string; to: string } {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();
	if (kind === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
	if (kind === "quarter") {
		const q = Math.floor(m / 3);
		return { from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
	}
	return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

// Сверять движение можно только в разумном окне вокруг его даты: счёт мог быть выставлен раньше,
// а оплата прийти позже. ±90 дней покрывает и предоплату, и просрочку в полквартала.
const MATCH_WINDOW_DAYS = 90;
const dayGap = (a: string, b: string) => {
	const da = Date.parse(`${a}T00:00:00Z`);
	const db = Date.parse(`${b}T00:00:00Z`);
	return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) / 86400000 : 999;
};
const withinWindow = (date: string, around: string) => dayGap(date, around) <= MATCH_WINDOW_DAYS;

// Цвет суммы по её знаку: приход — салатовый, расход — красный, ноль — обычный текст.
const amountColor = (value: number) => (value > 0 ? "#c6ff4d" : value < 0 ? "#EB5757" : undefined);

// Плитка сводки — как на дашборде и в Anlagen: подпись сверху, крупная цифра снизу.
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
	return (
		<div className="fs-card p-16">
			<p className="text-12 text-[#8c948b]">{label}</p>
			<p className="mt-6 text-20 font-semibold" style={{ color: color ?? "#f1f4ee" }}>{value}</p>
		</div>
	);
}

// Кандидаты на сверку: приход ищем среди открытых счетов клиентам, расход — среди расходов;
// всё, что вне окна вокруг даты движения, не показываем, чтобы список оставался коротким.
function buildCandidates(tx: BankTx, invoices: Invoice[], expenses: Expense[]): MatchCandidate[] {
	if (tx.amount > 0) {
		return invoices
			.filter((i) => i.kind === "invoice" && (i.status === "sent" || i.status === "overdue") && withinWindow(i.issueDate, tx.date))
			.map((i) => ({ id: i.id, label: `${i.number} · ${i.customerName}`, amount: i.totals.gross, date: i.issueDate }));
	}
	return expenses
		.filter((e) => withinWindow(e.date, tx.date))
		.map((e) => ({ id: e.id, label: e.vendor || "—", amount: -(Number(e.amount) || 0), date: e.date }));
}

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

	// Известные отказы сервера переводим на язык интерфейса, всё остальное показываем как пришло
	function serverMessage(message: string): string {
		const m = (message || "").toLowerCase();
		if (m.includes("already exists")) return t("bankErrDuplicate");
		if (m.includes("name is required")) return t("bankErrName");
		if (m.includes("no transactions found")) return t("bankErrNoRows");
		if (m.includes("account not found")) return t("bankErrAccountNotFound");
		if (m.includes("account is required")) return t("bankErrAccountRequired");
		if (m.includes("date must be")) return t("bankErrDate");
		if (m.includes("amount must not be zero")) return t("bankErrAmount");
		if (m.includes("matchid is required")) return t("bankErrMatchId");
		// «id is required» проверяем после matchId: строка «matchId is required» содержит и «id is required»
		if (m.includes("id is required")) return t("bankErrId");
		if (m.includes("invoice not found")) return t("bankErrInvoiceNotFound");
		if (m.includes("expense not found")) return t("bankErrExpenseNotFound");
		if (m.includes("transaction not found")) return t("bankErrTxNotFound");
		return message || t("bankSaveFailed");
	}

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
			setNotice(serverMessage(r.message));
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
		if (!r.ok) { setNotice(serverMessage(r.message)); return; }
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
			if (!r.ok || !r.data) { setImportNotice(serverMessage(r.message)); return; }
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
		if (!r.ok) { setNotice(serverMessage(r.message)); return; }
		toast.success(t("bankMatched"));
		setMatchOpen(false);
		reload();
	}

	async function unlink(tx: BankTx) {
		const r = await apiCall<BankTx>("/api/bank/transactions", "PATCH", { id: tx.id, matchType: "" });
		if (!r.ok) { toast.error(serverMessage(r.message)); return; }
		toast.success(t("bankUnlinked"));
		reload();
	}

	async function remove(tx: BankTx) {
		const r = await apiCall(`/api/bank/transactions?id=${tx.id}`, "DELETE");
		if (!r.ok) { toast.error(serverMessage(r.message)); return; }
		reload();
	}

	// Чистка ошибочного импорта: сервер удаляет только движения источника «import»,
	// вручную введённые и уже сверенные записи остаются
	async function clearImported() {
		if (!selectedId) return;
		const r = await apiCall<{ removed: number }>(`/api/bank/transactions?account=${selectedId}&all=1`, "DELETE");
		if (!r.ok || !r.data) { toast.error(serverMessage(r.message)); return; }
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
						<section className="fs-card overflow-x-auto">
							<table className="fs-table min-w-[860px]">
								<thead>
									<tr>
										<th className="px-16">{t("colDate")}</th>
										<th className="px-10">{t("colCounterparty")}</th>
										<th className="px-10">{t("colReference")}</th>
										<th className="px-10 text-right">{t("colAmount")}</th>
										<th className="px-10">{t("bankColMatch")}</th>
										<th className="px-10" />
									</tr>
								</thead>
								<tbody>
									{rows.map((tx) => (
										<tr key={tx.id}>
											<td className="px-16 text-13 text-[#8c948b]">{tx.date}</td>
											<td className="px-10 text-13 font-medium text-[#f1f4ee]">{tx.counterparty || "—"}</td>
											<td className="px-10 text-13 text-[#8c948b]">
												<span className="block max-w-[280px] truncate" title={tx.reference}>{tx.reference || "—"}</span>
											</td>
											<td className="px-10 text-right text-13 font-medium" style={{ color: amountColor(tx.amount) }}>{money(tx.amount, tx.currency, locale)}</td>
											<td className="px-10">
												{tx.matchType ? (
													<span className="fs-chip border-[rgba(198,255,77,0.35)] text-[#c6ff4d]">
														<TbReceipt size={14} aria-hidden />
														<span className="block max-w-[220px] truncate">{linkedLabel(tx)}</span>
													</span>
												) : (
													<span className="fs-chip border-[rgba(244,161,0,0.35)] text-[#F4A100]">{t("bankMatchNone")}</span>
												)}
											</td>
											<td className="px-10 text-right">
												<div className="flex items-center justify-end gap-14">
													{tx.matchType ? (
														<button type="button" onClick={() => unlink(tx)} className="fs-link whitespace-nowrap text-12">
															<TbLinkOff size={15} aria-hidden /> {t("bankUnlink")}
														</button>
													) : (
														<button
															type="button"
															onClick={() => { setNotice(""); setMatchTx(tx); setMatchOpen(true); }}
															className="fs-link whitespace-nowrap text-12">
															<TbLink size={15} aria-hidden /> {t("bankMatch")}
														</button>
													)}
													<button type="button" onClick={() => setToDelete(tx)} aria-label={t("delete")} className="text-[#9AA396] transition-colors hover:text-danger">
														<TbTrash size={16} />
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</section>
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
						<div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
							{accounts.map((a) => (
								<button
									key={a.id}
									type="button"
									onClick={() => openAccount(a.id)}
									className="fs-card flex flex-col p-16 text-left transition-colors hover:border-[rgba(198,255,77,0.35)]">
									<span className="flex items-start justify-between gap-10">
										<span className="min-w-0">
											<span className="block truncate text-14 font-medium text-[#f1f4ee]">{a.name}</span>
											<span className="mt-4 block truncate text-12 text-[#8c948b]">{a.iban || "—"}</span>
										</span>
										<span className={`fs-chip shrink-0 ${a.kind === "cash" ? "border-[rgba(244,161,0,0.35)] text-[#F4A100]" : ""}`}>
											{a.kind === "cash" ? <TbCash size={14} aria-hidden /> : <TbBuildingBank size={14} aria-hidden />}
											{a.kind === "cash" ? t("bankKindCash") : t("bankKindBank")}
										</span>
									</span>
									<span className="mt-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
										<span className="text-20 font-semibold text-[#f1f4ee]" style={{ color: amountColor(a.balance) }}>{money(a.balance, a.currency, locale)}</span>
										{/* Несверенные движения — то, ради чего экран существует; когда их нет, чип спокойный */}
										<span className={`fs-chip ${a.unmatched > 0 ? "border-[rgba(244,161,0,0.35)] text-[#F4A100]" : "text-[#8c948b]"}`}>
											{a.unmatched > 0 ? t("bankUnmatchedCount", { count: a.unmatched }) : t("bankAllMatched")}
										</span>
									</span>
									<span className="mt-10 block text-12 text-[#9AA396]">{t("bankShownCount", { count: a.transactionCount })}</span>
								</button>
							))}
						</div>
					)}
				</>
			)}

			{/* Создание счёта или кассы: поля ровно те, что принимает POST /api/bank/accounts */}
			<Modal open={accountOpen} onClose={() => setAccountOpen(false)} label={t("bankNewAccount")} className="w-full max-w-[480px]">
				<form onSubmit={createAccount} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("bankNewAccount")}</h2>
					<div className="flex flex-col gap-12">
						<FormField label={t("bankName")} value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} maxLength={200} autoFocus />
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("bankKind")}</span>
							<select value={accountForm.kind} onChange={(e) => setAccountForm({ ...accountForm, kind: e.target.value as Kind })} className="fs-field h-40 w-full px-12 text-13 outline-none">
								<option value="bank">{t("bankKindBank")}</option>
								<option value="cash">{t("bankKindCash")}</option>
							</select>
						</label>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("bankIban")} value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value.toUpperCase() })} maxLength={40} />
							<FormField label={t("bankBic")} value={accountForm.bic} onChange={(e) => setAccountForm({ ...accountForm, bic: e.target.value.toUpperCase() })} maxLength={20} />
						</div>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("bankOpeningBalance")} type="number" step="0.01" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} />
							<FormField label={t("bankOpeningDate")} type="date" value={accountForm.openingDate} onChange={(e) => setAccountForm({ ...accountForm, openingDate: e.target.value })} />
						</div>
						<p className="text-11 leading-[1.5] text-[#9AA396]">{t("bankOpeningHint")}</p>
					</div>
					{notice && <p className="mt-10 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setAccountOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
					</div>
				</form>
			</Modal>

			{/* Ручное движение — то, чем ведётся касса: дата, сумма (плюс — приход, минус — расход), контрагент */}
			<Modal open={manualOpen} onClose={() => setManualOpen(false)} label={t("bankAddMovement")} className="w-full max-w-[440px]">
				<form onSubmit={submitManual} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("bankAddMovement")}</h2>
					<p className="mb-14 mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("bankManualHint")}</p>
					<div className="flex flex-col gap-12">
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("colDate")} type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} />
							<FormField label={t("colAmount")} type="number" step="0.01" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })} autoFocus />
						</div>
						<p className="text-11 leading-[1.5] text-[#9AA396]">{t("bankAmountHint")}</p>
						<FormField label={t("colCounterparty")} value={manualForm.counterparty} onChange={(e) => setManualForm({ ...manualForm, counterparty: e.target.value })} maxLength={200} />
						<FormField label={t("colReference")} value={manualForm.reference} onChange={(e) => setManualForm({ ...manualForm, reference: e.target.value })} maxLength={500} />
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("notes")}</span>
							<textarea value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} maxLength={1000} rows={3} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
						</label>
					</div>
					{notice && <p className="mt-10 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setManualOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
					</div>
				</form>
			</Modal>

			{/* Сверка: приход сверяется со счетами клиентам, расход — с расходами. Кандидаты уже
			    отфильтрованы по окну вокруг даты и отсортированы так, что подсказка стоит первой. */}
			<Modal open={matchOpen} onClose={() => setMatchOpen(false)} label={t("bankMatchTitle")} className="w-full max-w-[480px]">
				{matchTx && (
					<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
						<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("bankMatchTitle")}</h2>
						<p className="mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("bankMatchHint", { days: MATCH_WINDOW_DAYS })}</p>
						<div className="mt-12 flex items-center justify-between gap-16 rounded-10 border border-inkLine px-12 py-9 text-13">
							<span className="min-w-0 truncate text-[#8c948b]">{matchTx.date} · {matchTx.counterparty || "—"}</span>
							<span className="shrink-0 font-medium" style={{ color: amountColor(matchTx.amount) }}>{money(matchTx.amount, matchTx.currency, locale)}</span>
						</div>
						{matchTx.reference && <p className="mt-8 text-12 leading-[1.5] text-[#9AA396]">{matchTx.reference}</p>}

						{candidates.list.length === 0 ? (
							<p className="mt-14 text-13 leading-[1.5] text-[#8c948b]">{t("bankNoCandidates")}</p>
						) : (
							<ul className="mt-10 flex flex-col">
								{candidates.list.map((c) => {
									const suggested = candidates.hint?.candidateId === c.id;
									return (
										<li key={c.id}>
											<button
												type="button"
												disabled={busy}
												onClick={() => match(matchTx, c.id)}
												className="flex w-full items-center justify-between gap-14 rounded-10 border border-transparent px-12 py-10 text-left transition-colors hover:border-[rgba(198,255,77,0.35)] hover:bg-[rgba(198,255,77,0.06)] disabled:opacity-[0.5]">
												<span className="min-w-0">
													<span className="block truncate text-13 font-medium text-[#f1f4ee]">{c.label}</span>
													<span className="mt-4 flex flex-wrap items-center gap-8 text-12 text-[#8c948b]">
														{c.date}
														{suggested && (
															<span className="fs-chip h-22 border-[rgba(198,255,77,0.35)] px-8 text-10 text-[#c6ff4d]">
																{t("bankMatchSuggestion")}
																{candidates.hint?.reason ? ` · ${t(`bankReason_${candidates.hint.reason}`)}` : ""}
															</span>
														)}
														{!suggested && Math.abs(c.amount - matchTx.amount) < 0.01 && (
															<span className="fs-chip h-22 border-[rgba(244,161,0,0.35)] px-8 text-10 text-[#F4A100]">{t("bankMatchAmount")}</span>
														)}
													</span>
												</span>
												<span className="shrink-0 text-13 font-medium" style={{ color: amountColor(c.amount) }}>{money(c.amount, matchTx.currency, locale)}</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
						{notice && <p className="mt-12 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
						<div className="mt-20 flex justify-end">
							<button type="button" onClick={() => setMatchOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						</div>
					</div>
				)}
			</Modal>

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
