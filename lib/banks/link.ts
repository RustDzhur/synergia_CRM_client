import { encryptJSON } from "@/lib/crypto";
import { importBankRows } from "@/lib/finance/bankImport";
import { orgMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

// Общий путь подключения счёта к банку по API (monobank, ПриватБанк): маршруты каждого банка
// приводят свои данные к этому виду, а хранение и запись движений живут здесь, чтобы правила
// не разъезжались между банками.

export interface BankLinkInput {
	provider: "monobank" | "privatbank";
	providerAccountId: string; // id счёта в банке (у ПриватБанка — IBAN)
	name: string; // имя счёта в CRM; пусто — подставится имя банка с хвостом номера
	iban?: string;
	currency?: string;
	/** Секреты для расшифровки на сервере (токены): в базу уходят зашифрованными и в браузер не возвращаются */
	secret: Record<string, string>;
	/** Кто подключает — записывается в согласие (ConsentRecord, kind bank_connect) */
	by?: string;
}

/** Привязать счёт CRM к счёту банка: повторная привязка обновляет запись, а не плодит двойников. */
export async function linkBankAccount(org: string, input: BankLinkInput) {
	const market = (await orgMarket(org)) ?? "UA";
	const existing = await prisma.bankAccount.findFirst({ where: { org, provider: input.provider, providerAccountId: input.providerAccountId } });
	let name = input.name.trim().slice(0, 100) || `${input.provider} · ${(input.iban ?? input.providerAccountId).slice(-4)}`;
	// Имя счёта уникально в фирме: второй счёт с тем же именем получает хвост номера
	if (!existing && (await prisma.bankAccount.findFirst({ where: { org, name } }))) name = `${name} ${input.providerAccountId.slice(-4)}`;
	const data = {
		market,
		name: existing ? existing.name : name,
		iban: input.iban ?? existing?.iban ?? "",
		currency: input.currency || existing?.currency || "UAH",
		provider: input.provider,
		providerAccountId: input.providerAccountId,
		providerSecret: encryptJSON(input.secret),
	};
	const doc = existing
		? await prisma.bankAccount.update({ where: { id: existing.id }, data })
		: await prisma.bankAccount.create({ data: { org, kind: "bank", ...data } });
	// подключение банка оформляется согласием (docs/TZ_MASTER.md §7.2 п. 3): отзыв — отвязка счёта
	if (!(await prisma.consentRecord.findFirst({ where: { org, kind: "bank_connect", subjectType: "bankaccount", subjectId: doc.id, revokedAt: null } }))) {
		await prisma.consentRecord.create({ data: { org, kind: "bank_connect", subjectType: "bankaccount", subjectId: doc.id, purpose: input.provider, grantedBy: input.by ?? "" } });
	}
	return doc;
}

/** Записать строки выписки и запомнить момент синхронизации. Возвращает отчёт импорта. */
export async function finishBankSync(org: string, account: { id: string; currency?: string } & Record<string, unknown>, rows: Array<{ date: string; amount: number; counterparty: string; reference: string; externalId: string }>, toSec: number) {
	const result = await importBankRows(org, account as never, rows, "auto");
	await prisma.bankAccount.update({ where: { id: account.id }, data: { providerSyncAt: new Date(toSec * 1000) } });
	return result;
}

/** Отвязать счёт от банка: токены удаляются, синхронизация прекращается сразу, согласие помечается отозванным. */
export async function unlinkBankAccount(org: string, accountId: string, by = "") {
	await prisma.bankAccount.update({ where: { id: accountId }, data: { provider: "", providerAccountId: "", providerSecret: "", providerSyncAt: null } });
	await prisma.consentRecord.updateMany({ where: { org, kind: "bank_connect", subjectType: "bankaccount", subjectId: accountId, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: by } });
}
