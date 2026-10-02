import { validId } from "@/lib/api";
import { notifyMembers } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

type Doc = any;

export interface FeedPostDTO {
    id: string;
    author: string;
    authorId: string;
    authorAvatar: string;
    at: string;
    kind: "post" | "task" | "news";
    text: string;
    taskTitle: string;
    responsible: string;
    dueAt: string;
    audience: "all" | "people";
    audienceIds: string[];
    audienceNames: string[];
    reactions: { emoji: string; count: number; mine: boolean }[];
    pinned: boolean;
    following: boolean;
    comments: { id: string; author: string; authorId: string; authorAvatar: string; at: string; text: string }[];
}

// Аватарки одним запросом: карточки ленты берут их отсюда, чтобы не делать запрос на каждого автора
export async function avatarMap(ids: string[]): Promise<Record<string, string>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return {};
    const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, avatarUrl: true } });
    const map: Record<string, string> = {};
    for (const u of users) map[u.id] = u.avatarUrl ?? "";
    return map;
}

// Авторы записей и комментариев — всё, что нужно для аватарок на странице ленты
export async function feedAvatars(posts: Doc[]): Promise<Record<string, string>> {
    const ids = new Set<string>();
    for (const p of posts) {
        ids.add(String(p.author));
        for (const c of (p.comments as any[]) ?? []) ids.add(String(c.author));
    }
    return avatarMap(Array.from(ids));
}

export const toFeedDTO = (p: Doc, userId: string, avatars: Record<string, string> = {}): FeedPostDTO => ({
    id: p.id,
    author: p.authorName,
    authorId: String(p.author),
    authorAvatar: avatars[String(p.author)] ?? "",
    at: (p.createdAt as Date).toISOString(),
    kind: p.kind,
    text: p.text ?? "",
    taskTitle: p.taskTitle ?? "",
    responsible: p.responsible ?? "",
    dueAt: p.dueAt ?? "",
    audience: p.audience === "people" ? "people" : "all",
    audienceIds: (p.audienceIds ?? []).map((v: unknown) => String(v)),
    audienceNames: p.audienceNames ?? [],
    reactions: ((p.reactions as any[]) ?? [])
        .filter((r: Doc) => (r.users ?? []).length > 0)
        .map((r: Doc) => ({ emoji: r.emoji as string, count: (r.users as unknown[]).length, mine: (r.users as unknown[]).some((u) => String(u) === userId) })),
    pinned: !!p.pinned,
    following: ((p.followers as unknown[]) ?? []).some((f: unknown) => String(f) === userId),
    // комментарии хранятся в Json: id и createdAt приходят строками (у старых — Mongo-поля _id/Date)
    comments: ((p.comments as any[]) ?? []).map((c: Doc) => ({ id: String(c.id ?? c._id ?? ""), author: c.authorName, authorId: String(c.author), authorAvatar: avatars[String(c.author)] ?? "", at: new Date(c.createdAt).toISOString(), text: c.text })),
});

export async function userName(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstname: true, lastname: true } });
    return u ? `${u.firstname} ${u.lastname}`.trim() : "";
}

const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const LINK = "/crm/collaboration/feed";
const MAX_AUDIENCE = 50;

// Кому адресована запись: оставляем только участников этой фирмы — чужой id не должен попасть в адресаты.
// Сотрудника сопоставляем с участником по почте: если он зарегистрирован, он получит уведомление.
export async function resolveAudience(org: string, raw: unknown): Promise<{ ids: string[]; names: string[] }> {
    const wanted = Array.isArray(raw)
        ? Array.from(new Set(raw.filter((v): v is string => typeof v === "string" && validId(v)))).slice(0, MAX_AUDIENCE)
        : [];
    if (!wanted.length) return { ids: [], names: [] };

    // сначала участники: их id и есть адресаты уведомлений
    const members = await prisma.membership.findMany({ where: { org, user: { in: wanted } }, select: { user: true } });
    const memberIds = new Set(members.map((m) => String(m.user)));

    // остальные id могут быть сотрудниками справочника
    const rest = wanted.filter((id) => !memberIds.has(id));
    const employees = rest.length
        ? await prisma.employee.findMany({ where: { id: { in: rest }, owner: org }, select: { id: true, firstname: true, lastname: true, email: true } })
        : [];
    const employeeNames = new Map(employees.map((e) => [e.id, `${e.firstname} ${e.lastname}`.trim()]));

    // сотрудник с аккаунтом: почта совпадает с участником фирмы
    const emails = employees.map((e) => (e.email ?? "").toLowerCase()).filter(Boolean);
    const byEmail = emails.length
        ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
        : [];
    const idByEmail = new Map(byEmail.map((u) => [(u.email ?? "").toLowerCase(), u.id]));
    const linked = new Set(
        employees.map((e) => idByEmail.get((e.email ?? "").toLowerCase())).filter((id): id is string => !!id && memberIds.has(id))
    );

    const ids = Array.from(new Set(wanted.filter((id) => memberIds.has(id)).concat(Array.from(linked))));
    const users = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstname: true, lastname: true } })
        : [];
    // имена собираем по всем адресатам, включая сотрудников без аккаунта — иначе карточка покажет пустоту
    const names = wanted
        .map((id) => {
            const u = users.find((x) => x.id === id);
            if (u) return `${u.firstname} ${u.lastname}`.trim();
            return employeeNames.get(id) ?? "";
        })
        .filter(Boolean);
    return { ids, names };
}

// Новая запись коллеги: остальные участники фирмы получают уведомление. Запись «лично» уходит только адресатам.
export async function announcePost(org: string, post: Doc) {
    const ids = ((post.audienceIds as unknown[]) ?? []).map((v) => String(v));
    const only = post.audience === "people" && ids.length ? ids : undefined;
    await notifyMembers(org, { type: "team", params: { name: post.authorName, text: short(post.kind === "task" ? post.taskTitle : post.text) }, link: LINK, key: `feed:${post.id}` }, { except: String(post.author), only });
}

// Комментарий: получают автор записи и те, кто за ней следит, — плюс все, кто уже комментировал ветку
export async function announceComment(org: string, post: Doc, commentId: string, authorId: string, authorName: string, text: string) {
    const only = new Set<string>([String(post.author), ...((post.followers as unknown[]) ?? []).map(String), ...(((post.comments as any[]) ?? []).map((c: Doc) => String(c.author)))]);
    await notifyMembers(org, { type: "team", params: { name: authorName, text: short(text) }, link: LINK, key: `feed-c:${post.id}:${commentId}` }, { except: authorId, only: Array.from(only) });
}

// Задача, созданная в CRM, попадает в ленту карточкой: коллеги видят, кто и что поручил
export async function postTask(org: string, userId: string, task: { id: string; title: string; responsible?: string; deadline?: string }) {
    try {
        const authorName = await userName(userId);
        const post = await prisma.feedPost.create({ data: { org, author: userId, authorName, kind: "task", taskId: task.id, taskTitle: task.title, responsible: task.responsible ?? "", dueAt: task.deadline ?? "" } });
        await announcePost(org, post);
    } catch (e) {
        console.error("postTask failed", e);
    }
}

// Срок записи: принимаем только "YYYY-MM-DDTHH:mm" (тот же формат, что у задачи), иначе пустая строка
export const cleanDueAt = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : "");
