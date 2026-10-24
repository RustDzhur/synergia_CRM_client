"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Comment { id: string; authorName: string; text: string; mentions: string[]; createdAt: string }
interface Person { id: string; name: string }

// Обсуждение документа в проверке: комментарии с упоминаниями (упомянутый получает уведомление)
export default function DocComments({ kind, id }: { kind: "invoices" | "expenses" | "legal"; id: string }) {
	const t = useTranslations("finance");
	const [open, setOpen] = useState(false);
	const [list, setList] = useState<Comment[]>([]);
	const [people, setPeople] = useState<Person[]>([]);
	const [text, setText] = useState("");
	const [mention, setMention] = useState<string[]>([]);

	const load = useCallback(async () => {
		const r = await apiCall<{ comments: Comment[]; people: Person[] }>(`/api/review/comments?kind=${kind}&id=${id}`, "GET", undefined, { cache: "no-store" });
		if (r.ok && r.data) { setList(r.data.comments); setPeople(r.data.people); }
	}, [kind, id]);
	useEffect(() => { if (open) void load(); }, [open, load]);

	async function send() {
		const r = await apiCall("/api/review/comments", "POST", { kind, id, text, mentions: mention });
		if (!r.ok) return void toast.error(r.message);
		setText(""); setMention([]);
		void load();
	}
	const name = (uid: string) => people.find((p) => p.id === uid)?.name ?? "";
	return (
		<div className="w-full">
			<button type="button" className="text-12 text-[#8c948b] hover:underline" onClick={() => setOpen(!open)}>{t("commentsToggle")}</button>
			{open && (
				<div className="mt-8 flex flex-col gap-6">
					{list.map((c) => <p key={c.id} className="text-12 leading-[1.5] text-[#cfd4cb]"><span className="text-[#8c948b]">{c.authorName}: </span>{c.text}{c.mentions.length > 0 && <span className="ml-6 text-[#c6ff4d]">{c.mentions.map((m) => `@${name(m)}`).join(" ")}</span>}</p>)}
					<div className="flex flex-wrap items-center gap-6">
						<input className="fs-field h-34 min-w-[220px] flex-1 px-10 text-12 outline-none" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("commentPlaceholder")} maxLength={2000} />
						<select multiple className="fs-field h-34 max-w-[160px] text-12" value={mention} onChange={(e) => setMention(Array.from(e.target.selectedOptions, (o) => o.value))} title={t("commentMention")}>
							{people.map((p) => <option key={p.id} value={p.id}>@{p.name}</option>)}
						</select>
						<button type="button" disabled={!text.trim()} className="fs-btn fs-btn-ghost h-34 text-12 disabled:opacity-50" onClick={() => void send()}>{t("commentSend")}</button>
					</div>
				</div>
			)}
		</div>
	);
}
