import { ProviderError } from "@/lib/http";

// Выписка ПриватБанка по API «Автоклієнт» (Приват24 для бізнесу): фирма включает АПІ в кабинете
// otp24.privatbank.ua и получает пару «id + token». Тонкий клиент: адреса, заголовки и разбор
// ответа в одном месте, поэтому проверяется офлайн-тестом с подменённым fetch.
//
// Особенности, которые здесь учтены:
// • все запросы — POST, даже чтение; заголовки авторизации — id и token;
// • период выписки задаётся строками дд-мм-гггг и ограничен 31 днём — длинный режем на окна;
// • ответ постраничный: nextPageId возвращаем в followId, пока страницы не кончатся;
// • суммы в ответе — строки; единицы (гривны или копейки) банк явно не пишет, поэтому разбор
//   защитный: значение с точкой/запятой читается как есть, целое — как копейки.
//   Первую выписку стоит сверить с кабинетом банка: если суммы разойдутся в 100 раз, поправьте
//   unitsAreCoins ниже — это единственная настройка разбора.

const BASE = "https://acp.privatbank.ua/api";
export const PRIVAT_WINDOW_DAYS = 31;
/** Целые числа в выписке АК — копейки (уточняется первой сверкой с кабинетом банка). */
const unitsAreCoins = true;

export interface PrivatTx {
	externalId: string;
	date: string; // YYYY-MM-DD
	amount: number; // плюс — приход, минус — расход, в основных единицах
	counterparty: string;
	reference: string;
}

export interface PrivatBalance {
	account: string; // IBAN
	currency: string;
	balance: number;
	name: string;
}

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** «дд-мм-гггг» в unix-секунды начала дня (UTC). */
export function unixFromPrivate(date: string): number {
	const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(date ?? ""));
	return m ? Math.floor(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) / 1000) : NaN;
}

/** Сумма из выписки: строка с разделителем — деньги как есть; целое — копейки (иногда с ведущими нулями). */
export function parsePrivatAmount(raw: unknown): number {
	const s = String(raw ?? "").trim().replace(/\s/g, "");
	if (!s) return 0;
	const normalized = s.replace(",", ".");
	const value = Number(normalized);
	if (!Number.isFinite(value)) return 0;
	const hasFraction = /[.,]/.test(s);
	if (hasFraction || !unitsAreCoins) return value;
	return Math.round(value) / 100;
}

/** Дата операции из выписки: «дд.мм.гггг» или «дд-мм-гггг» → YYYY-MM-DD. */
export function privatDate(raw: unknown): string {
	const s = String(raw ?? "").trim();
	const m = /^(\d{2})[.-](\d{2})[.-](\d{4})/.exec(s);
	if (m) return `${m[3]}-${m[2]}-${m[1]}`;
	const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
	return iso ? iso[0] : "";
}

async function request<T>(path: string, query: Record<string, string>, credentials: { id: string; token: string }): Promise<T> {
	const qs = new URLSearchParams(query).toString();
	let res: Response;
	try {
		res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
			method: "POST",
			headers: { id: credentials.id.trim(), token: credentials.token.trim(), "Content-Type": "application/json" },
			body: "",
			cache: "no-store",
		});
	} catch {
		throw new ProviderError("ПриватБанк недоступний: перевірте з'єднання і спробуйте ще раз");
	}
	const json = (await res.json().catch(() => null)) as { errorMessage?: string; message?: string } | null;
	if (!res.ok) {
		if (res.status === 401 || res.status === 403) throw new ProviderError("ПриватБанк не прийняв id або token: візьміть їх у кабінеті otp24.privatbank.ua (АПІ «Автоклієнт»), а IP комп'ютера має бути дозволений у кабінеті банку");
		if (res.status === 429) throw new ProviderError("ПриватБанк просить зачекати: забагато запитів, спробуйте за годину");
		throw new ProviderError(json?.errorMessage || json?.message || `ПриватБанк відповів помилкою ${res.status}`);
	}
	return json as T;
}

interface PrivatJson { [key: string]: unknown }

const asArray = (v: unknown): PrivatJson[] => (Array.isArray(v) ? (v as PrivatJson[]) : []);

/** Баланс по счёту — им же проверяется пара id+token и IBAN до сохранения подключения. */
export async function privatBalance(credentials: { id: string; token: string }, iban: string): Promise<PrivatBalance> {
	const json = await request<PrivatJson>("/statements/balance", { acc: iban.trim(), limit: "1" }, credentials);
	const rows = asArray((json as PrivatJson).balances ?? (json as PrivatJson).Balance ?? (json as PrivatJson).data) ;
	const row = rows[0] ?? {};
	const account = str(row.acc ?? row.ACC ?? row.account, 40);
	if (!account) throw new ProviderError("ПриватБанк не підтвердив рахунок: перевірте IBAN (саме цей рахунок має бути доступний АПІ у кабінеті банку)");
	return {
		account,
		currency: str(row.ccy ?? row.CCY ?? row.currency, 6) || "UAH",
		balance: parsePrivatAmount(row.balanceD ?? row.BALANCE ?? row.balance ?? row.ostc ?? row.OSTC),
		name: str(row.name ?? row.NAME, 100) || `ПриватБанк · ${account.slice(-4)}`,
	};
}

// Поля строки выписки АК (имена исторические и в разном регистре — читаем все варианты)
const txAmount = (r: PrivatJson) => {
	// TRANTYPE: C/D — приход/расход; знак берём из него, значение по модулю
	const sum = parsePrivatAmount(r.SUM ?? r.sum ?? r.OSND_SUM);
	const type = str(r.TRANTYPE ?? r.trantype, 1).toUpperCase();
	const debit = type === "D" || type === "DEB";
	return debit ? -Math.abs(sum) : Math.abs(sum);
};

/** Выписка за период: окна не длиннее 31 дня, страницы — по nextPageId. */
export async function privatStatement(credentials: { id: string; token: string }, iban: string, fromSec: number, toSec: number): Promise<PrivatTx[]> {
	if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec >= toSec) return [];
	const fmt = (sec: number) => {
		const d = new Date(sec * 1000);
		const p = (n: number) => String(n).padStart(2, "0");
		return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
	};
	const out = new Map<string, PrivatTx>();
	const windowSec = PRIVAT_WINDOW_DAYS * 24 * 3600 - 600;
	let windowStart = fromSec;
	// Не больше 10 окон за синхронизацию (≈10 месяцев): защита от «с прошлого века»
	for (let w = 0; windowStart < toSec && w < 10; w++) {
		const windowEnd = Math.min(windowStart + windowSec, toSec);
		let followId = "";
		// Страницы внутри окна: не больше 20 запросов, чтобы битый nextPageId не зациклил синхронизацию
		for (let page = 0; page < 20; page++) {
			const json = await request<PrivatJson>("/statements/transactions", {
				acc: iban.trim(),
				startDate: fmt(windowStart),
				endDate: fmt(windowEnd),
				limit: "100",
				...(followId ? { followId } : {}),
			}, credentials);
			const rows = asArray((json as PrivatJson).transactions ?? (json as PrivatJson).Transactions ?? (json as PrivatJson).data);
			for (const r of rows) {
				const id = str(r.TECHNICAL_TRANSACTION_ID ?? r.ID ?? r.id, 60);
				const date = privatDate(r.DAT_OD ?? r.DATE ?? r.dat_od);
				if (!id || !date) continue;
				out.set(id, {
					externalId: id,
					date,
					amount: txAmount(r),
					counterparty: str(r.AUT_CNTR_NAM ?? r.counterName ?? r.OSND, 200),
					reference: str(r.OSND ?? r.REF ?? r.description, 300),
				});
			}
			followId = str((json as PrivatJson).nextPageId ?? (json as PrivatJson).NextPageId, 60);
			if (!followId || !rows.length) break;
		}
		windowStart = windowEnd;
	}
	return Array.from(out.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Окно синхронизации: с прошлой синхронизации (или на месяц назад), но не чаще периода выписки. */
export function privatSyncWindow(lastSyncAt: Date | null | undefined, nowSec = Math.floor(Date.now() / 1000)): { from: number; to: number } {
	const floor = nowSec - PRIVAT_WINDOW_DAYS * 24 * 3600;
	const base = lastSyncAt ? Math.floor(lastSyncAt.getTime() / 1000) - 24 * 3600 : floor;
	return { from: Math.max(Math.min(base, nowSec), floor), to: nowSec };
}
