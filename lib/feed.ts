import type { HydratedDocument } from "mongoose";
import { notifyMembers } from "@/lib/notify";
import FeedPost from "@/models/FeedPost";
import User from "@/models/User";

type Doc = HydratedDocument<any>;

export interface FeedPostDTO {
    id: string;
    author: string;
    authorId: string;
    at: string;
    kind: "post" | "task";
    text: string;
    taskTitle: string;
    responsible: string;
    pinned: boolean;
    following: boolean;
    comments: { id: string; author: string; authorId: string; at: string; text: string }[];
}

export const toFeedDTO = (p: Doc, userId: string): FeedPostDTO => ({
    id: String(p._id),
    author: p.authorName,
    authorId: String(p.author),
    at: (p.createdAt as Date).toISOString(),
    kind: p.kind,
    text: p.text ?? "",
    taskTitle: p.taskTitle ?? "",
    responsible: p.responsible ?? "",
    pinned: !!p.pinned,
    following: (p.followers ?? []).some((f: unknown) => String(f) === userId),
    comments: (p.comments ?? []).map((c: Doc) => ({ id: String(c._id), author: c.authorName, authorId: String(c.author), at: (c.createdAt as Date).toISOString(), text: c.text })),
});

export async function userName(userId: string) {
    const u = await User.findById(userId).select("firstname lastname").lean<{ firstname: string; lastname: string }>();
    return u ? `${u.firstname} ${u.lastname}`.trim() : "";
}

const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const LINK = "/crm/collaboration/feed";

// Новая запись коллеги: остальные участники фирмы получают уведомление
export async function announcePost(org: string, post: Doc) {
    await notifyMembers(org, { type: "team", params: { name: post.authorName, text: short(post.kind === "task" ? post.taskTitle : post.text) }, link: LINK, key: `feed:${post._id}` }, { except: String(post.author) });
}

// Комментарий: получают автор записи и те, кто за ней следит, — плюс все, кто уже комментировал ветку
export async function announceComment(org: string, post: Doc, commentId: string, authorId: string, authorName: string, text: string) {
    const only = new Set<string>([String(post.author), ...(post.followers ?? []).map(String), ...(post.comments ?? []).map((c: Doc) => String(c.author))]);
    await notifyMembers(org, { type: "team", params: { name: authorName, text: short(text) }, link: LINK, key: `feed-c:${post._id}:${commentId}` }, { except: authorId, only: Array.from(only) });
}

// Задача, созданная в CRM, попадает в ленту карточкой: коллеги видят, кто и что поручил
export async function postTask(org: string, userId: string, task: { _id: unknown; title: string; responsible?: string }) {
    try {
        const authorName = await userName(userId);
        const post = await FeedPost.create({ org, author: userId, authorName, kind: "task", taskId: task._id, taskTitle: task.title, responsible: task.responsible ?? "" });
        await announcePost(org, post);
    } catch (e) {
        console.error("postTask failed", e);
    }
}
