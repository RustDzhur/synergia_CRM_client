import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Мост «Робот-офис → облачный Harness».
 *
 * Зачем: у облачного агента Harness больше возможностей (репозитории, сборки,
 * правки кода, длинные задачи), чем у робота внутри CRM. Робот не получает
 * доступ к серверу — он кладёт задачу в очередь, облачный агент забирает её
 * по своему токену (право «harness»), выполняет и возвращает результат.
 *
 * Безопасность: токен выдаётся в CRM (Настройки → Интеграции → Агенты) и
 * проверяется существующим authorizeAgent; агент видит только задачи той
 * фирмы, для которой создан (запись привязана к организации).
 */

const KEY = "office:harness";

/**
 * Чья очередь: в пилоте одна платформа — задачи кладёт фирма администратора
 * платформы. Когда появятся отдельные токены на клиента, здесь будет org из
 * токена; сейчас ограничение осознанное (иначе один токен видел бы чужие задачи).
 */
export async function harnessOrg(): Promise<string | null> {
  const rows = await prisma.sectionRecord.findMany({ where: { key: "admin:env" }, take: 200, select: { org: true } });
  for (const row of Array.from(new Map(rows.map((r) => [r.org, r])).values())) {
    const org = await prisma.organization.findUnique({ where: { id: row.org }, select: { ownerUser: true } }).catch(() => null);
    if (!org) continue;
    return row.org;
  }
  return null;
}
const TTL_HOURS = 24;

export interface HarnessRequest {
  readonly id: string;
  readonly text: string;
  readonly robot: string;
  readonly robotName: string;
  readonly status: "queued" | "running" | "done" | "failed";
  readonly result?: string;
  readonly createdAt: string;
  readonly claimedAt?: string;
  readonly finishedAt?: string;
}

interface Row {
  id: string;
  values: Record<string, unknown>;
}

const toRequest = (row: Row): HarnessRequest => ({
  id: row.id,
  text: String(row.values.text ?? ""),
  robot: String(row.values.robot ?? ""),
  robotName: String(row.values.robotName ?? ""),
  status: (row.values.status as HarnessRequest["status"]) ?? "queued",
  ...(row.values.result ? { result: String(row.values.result) } : {}),
  createdAt: String(row.values.createdAt ?? ""),
  ...(row.values.claimedAt ? { claimedAt: String(row.values.claimedAt) } : {}),
  ...(row.values.finishedAt ? { finishedAt: String(row.values.finishedAt) } : {}),
});

/** Робот передаёт задачу облачному агенту. Возвращает идентификатор запроса. */
export async function delegateToHarness(input: { org: string; userId: string; text: string; robot: string; robotName: string }): Promise<HarnessRequest> {
  const id = `h${randomBytes(8).toString("hex")}`;
  const values = {
    text: input.text.slice(0, 20000),
    robot: input.robot,
    robotName: input.robotName,
    requestedBy: input.userId,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await prisma.sectionRecord.create({ data: { org: input.org, key: KEY, rid: id, values: values as never } });
  return toRequest({ id, values });
}

/** Агент забирает ближайшую задачу очереди (status queued → running). */
export async function claimHarnessTask(org: string): Promise<HarnessRequest | null> {
  const rows = await prisma.sectionRecord.findMany({ where: { org, key: KEY }, orderBy: { createdAt: "asc" }, take: 50 });
  const queued = rows.map((row) => ({ row, request: toRequest({ id: row.rid, values: row.values as Record<string, unknown> }) })).find(({ request }) => request.status === "queued");
  if (!queued) return null;
  const values = { ...queued.request, status: "running", claimedAt: new Date().toISOString() };
  await prisma.sectionRecord.update({ where: { id: queued.row.id }, data: { values: values as never } });
  return { ...queued.request, status: "running", claimedAt: values.claimedAt };
}

/** Результат от агента: запись в очередь + задача владельцу, чтобы отчёт не потерялся. */
export async function completeHarnessTask(org: string, id: string, input: { result: string; ok: boolean }): Promise<HarnessRequest | null> {
  const row = await prisma.sectionRecord.findFirst({ where: { org, key: KEY, rid: id } });
  if (!row) return null;
  const current = toRequest({ id: row.rid, values: row.values as Record<string, unknown> });
  const values = {
    ...current,
    status: input.ok ? "done" : "failed",
    result: input.result.slice(0, 20000),
    finishedAt: new Date().toISOString(),
  };
  await prisma.sectionRecord.update({ where: { id: row.id }, data: { values: values as never } });
  await prisma.task.create({
    data: {
      owner: org,
      title: `Harness: ${current.text.slice(0, 120)}`.slice(0, 200),
      description: `Задача для облачного агента (${current.robotName || current.robot}).\n\nРезультат:\n${input.result}`.slice(0, 9000),
      deadline: "",
      createdBy: "Harness-Agent",
      responsible: "",
    },
  }).catch(() => undefined);
  return toRequest({ id: row.rid, values });
}

/** Запросы этой фирмы (для карточки робота/истории). */
export async function listHarnessRequests(org: string, limit = 20): Promise<HarnessRequest[]> {
  const rows = await prisma.sectionRecord.findMany({ where: { org, key: KEY }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
  return rows.map((row) => toRequest({ id: row.rid, values: row.values as Record<string, unknown> }));
}

/** Уборка старых записей (старше суток) при постановке новой задачи. */
export async function pruneHarness(org: string): Promise<void> {
  const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000);
  await prisma.sectionRecord.deleteMany({ where: { org, key: KEY, createdAt: { lt: cutoff } } }).catch(() => undefined);
}
