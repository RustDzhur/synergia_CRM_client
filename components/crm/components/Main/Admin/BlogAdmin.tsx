"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { apiCall } from "@/app/store/crmApi";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";

interface Tx { en: string; de: string; ua: string }
interface Post { id: string; slug: string; image: string; title: Tx; excerpt: Tx; body: Tx[]; published: boolean; publishedAt: string }

const EMPTY_TX: Tx = { en: "", de: "", ua: "" };
const PRESET_IMAGES = ["/images/blog/code.jpg", "/images/blog/laptop.jpg", "/images/blog/sofa.jpg"];
const LANGS: { key: keyof Tx; label: string }[] = [{ key: "en", label: "EN" }, { key: "de", label: "DE" }, { key: "ua", label: "UA" }];

// многострочный текст с abzацами — одна пустая строка отделяет один параграф от другого
const bodyToText = (body: Tx[], lang: keyof Tx) => body.map((p) => p[lang]).join("\n\n");
const textToBody = (values: Record<keyof Tx, string>): Tx[] => {
	const perLang = LANGS.map((l) => values[l.key].split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean));
	const max = Math.max(...perLang.map((a) => a.length), 0);
	return Array.from({ length: max }, (_, i) => ({ en: perLang[0][i] ?? "", de: perLang[1][i] ?? "", ua: perLang[2][i] ?? "" }));
};

// Управление статьями блога лендинга (/blog): доступно только владельцу платформы, в том же кабинете, что и фирмы-клиенты.
// Статьи хранятся в БД (models/BlogPost.ts) — раньше это был статический массив в коде, теперь его правит не разработчик.
export default function BlogAdmin() {
	const t = useTranslations("admin");
	const [posts, setPosts] = useState<Post[]>([]);
	const [open, setOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<string | null>(null);
	const [slug, setSlug] = useState("");
	const [image, setImage] = useState(PRESET_IMAGES[0]);
	const [published, setPublished] = useState(true);
	const [title, setTitle] = useState<Tx>({ ...EMPTY_TX });
	const [excerpt, setExcerpt] = useState<Tx>({ ...EMPTY_TX });
	const [bodyText, setBodyText] = useState<Record<keyof Tx, string>>({ en: "", de: "", ua: "" });

	const load = () => apiCall<Post[]>("/api/admin/blog").then((r) => r.data && setPosts(r.data));
	useEffect(() => { load(); }, []);

	function openNew() {
		setEditId(null); setSlug(""); setImage(PRESET_IMAGES[0]); setPublished(true);
		setTitle({ ...EMPTY_TX }); setExcerpt({ ...EMPTY_TX }); setBodyText({ en: "", de: "", ua: "" });
		setOpen(true);
	}
	function openEdit(p: Post) {
		setEditId(p.id); setSlug(p.slug); setImage(p.image); setPublished(p.published);
		setTitle({ en: p.title?.en ?? "", de: p.title?.de ?? "", ua: p.title?.ua ?? "" });
		setExcerpt({ en: p.excerpt?.en ?? "", de: p.excerpt?.de ?? "", ua: p.excerpt?.ua ?? "" });
		setBodyText({ en: bodyToText(p.body, "en"), de: bodyToText(p.body, "de"), ua: bodyToText(p.body, "ua") });
		setOpen(true);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.en.trim()) return toast.error(t("blogTitleRequired"));
		const data = { slug: slug.trim(), image, published, title, excerpt, body: textToBody(bodyText) };
		const res = editId ? await apiCall(`/api/admin/blog/${editId}`, "PATCH", data) : await apiCall("/api/admin/blog", "POST", data);
		if (!res.ok) return toast.error(res.message);
		toast.success(t("saved"));
		setOpen(false);
		load();
	}
	async function remove(id: string) {
		const res = await apiCall(`/api/admin/blog/${id}`, "DELETE");
		if (!res.ok) toast.error(res.message);
		setToDelete(null);
		load();
	}

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";
	const area = "fs-field fs-scroll w-full p-10 text-13 outline-none";

	return (
		<div className="mt-24">
			<div className="mb-12 flex items-center justify-between gap-12">
				<h2 className="text-14 font-semibold text-[#f1f4ee]">{t("blogTitle")}</h2>
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-34">
					<TbPlus size={16} /> {t("blogNew")}
				</button>
			</div>
			<div className="fs-card overflow-x-auto">
				<table className="fs-table min-w-[640px]">
					<thead>
						<tr>
							{[t("blogColTitle"), t("blogColSlug"), t("blogColDate"), t("blogColStatus"), ""].map((h, i) => <th key={i} className="px-12 py-12">{h}</th>)}
						</tr>
					</thead>
					<tbody>
						{posts.map((p) => (
							<tr key={p.id}>
								<td className="px-12 py-10 text-13 font-medium text-[#f1f4ee]">{p.title.en || "—"}</td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">{p.slug}</td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">{p.publishedAt}</td>
								<td className="px-12 py-10">
									<span className={`rounded-50 px-10 py-2 text-10 font-medium ${p.published ? "bg-[rgba(45,222,182,0.12)] text-[#2DDEB6]" : "bg-[rgba(255,255,255,0.05)] text-[#8c948b]"}`}>
										{p.published ? t("blogPublished") : t("blogDraft")}
									</span>
								</td>
								<td className="px-12 py-10">
									<div className="flex items-center gap-12">
										<button type="button" onClick={() => openEdit(p)} aria-label={t("edit")} className="text-[#c6ff4d] hover:opacity-80"><TbPencil size={16} /></button>
										<button type="button" onClick={() => setToDelete(p.id)} aria-label={t("blogDelete")} className="text-[#9AA396] hover:text-danger"><TbTrash size={16} /></button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{posts.length === 0 && <p className="py-30 text-center text-13 text-[#8c948b]">{t("none")}</p>}
			</div>

			<Modal open={open} onClose={() => setOpen(false)} label={editId ? t("blogEdit") : t("blogNew")} className="w-full max-w-[720px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20">
					<h2 className="mb-16 text-16 font-semibold text-[#f1f4ee]">{editId ? t("blogEdit") : t("blogNew")}</h2>

					<div className="mb-14 grid grid-cols-1 gap-14 md:grid-cols-2">
						<FormField label={t("blogSlug")} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t("blogSlugHint")} maxLength={80} />
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("blogImage")}</span>
							<select value={PRESET_IMAGES.includes(image) ? image : "custom"} onChange={(e) => setImage(e.target.value === "custom" ? "" : e.target.value)} className={field}>
								{PRESET_IMAGES.map((src) => <option key={src} value={src}>{src.split("/").pop()}</option>)}
								<option value="custom">{t("blogImageCustom")}</option>
							</select>
						</label>
					</div>
					{!PRESET_IMAGES.includes(image) && (
						<div className="mb-14"><FormField label={t("blogImageUrl")} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" maxLength={300} /></div>
					)}

					<label className="mb-16 flex items-center gap-10 text-13 text-[#cfd4cb]">
						<input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-18 w-18 accent-[#c6ff4d]" />
						{t("blogPublished")}
					</label>

					{LANGS.map((l) => (
						<div key={l.key} className="mb-20 rounded-10 border border-inkLine p-14">
							<p className="mb-10 text-12 font-semibold text-[#8c948b]">{l.label}</p>
							<div className="mb-10"><FormField label={t("blogArticleTitle")} value={title[l.key]} onChange={(e) => setTitle({ ...title, [l.key]: e.target.value })} maxLength={200} /></div>
							<div className="mb-10">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("blogExcerpt")}</span>
								<textarea value={excerpt[l.key]} onChange={(e) => setExcerpt({ ...excerpt, [l.key]: e.target.value })} maxLength={400} rows={2} className={area} />
							</div>
							<div>
								<span className="mb-6 block text-12 text-[#8c948b]">{t("blogBody")}</span>
								<textarea value={bodyText[l.key]} onChange={(e) => setBodyText({ ...bodyText, [l.key]: e.target.value })} rows={6} placeholder={t("blogBodyHint")} className={area} />
							</div>
						</div>
					))}

					<div className="mt-10 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("blogDelete")} text={t("blogConfirmDelete")} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
		</div>
	);
}
