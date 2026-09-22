"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDelete, MdEdit } from "react-icons/md";
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

	const field = "h-[40px] w-full rounded-8 border border-[#E6E6E6] bg-white px-8 text-14 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]";
	const area = "w-full rounded-8 border border-[#E6E6E6] bg-white p-8 text-14 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]";

	return (
		<div className="mt-24">
			<div className="mb-12 flex items-center justify-between gap-12">
				<h2 className="text-18 font-medium text-[#333333]">{t("blogTitle")}</h2>
				<button type="button" onClick={openNew} className="flex h-[36px] items-center gap-6 rounded-8 bg-primaryColor px-14 text-14 font-medium text-white transition-opacity hover:opacity-80">
					<MdAdd size={18} /> {t("blogNew")}
				</button>
			</div>
			<div className="overflow-x-auto rounded-16 bg-white shadow-heroImage">
				<table className="w-full min-w-[640px] border-collapse text-left text-14">
					<thead>
						<tr className="border-b border-[#F0F0F0] bg-[#FAFCFF] text-[#999999]">
							{[t("blogColTitle"), t("blogColSlug"), t("blogColDate"), t("blogColStatus"), ""].map((h, i) => <th key={i} className="px-12 py-12 font-medium">{h}</th>)}
						</tr>
					</thead>
					<tbody>
						{posts.map((p) => (
							<tr key={p.id} className="border-b border-[#F0F0F0]">
								<td className="px-12 py-10 font-medium text-[#333333]">{p.title.en || "—"}</td>
								<td className="px-12 py-10 text-[#999999]">{p.slug}</td>
								<td className="px-12 py-10 text-[#999999]">{p.publishedAt}</td>
								<td className="px-12 py-10">
									<span className={`rounded-4 px-8 py-2 text-12 font-medium ${p.published ? "bg-[#E8F8EE] text-[#0A8A2E]" : "bg-[#F5F5F5] text-[#999999]"}`}>
										{p.published ? t("blogPublished") : t("blogDraft")}
									</span>
								</td>
								<td className="px-12 py-10">
									<div className="flex items-center gap-12">
										<button type="button" onClick={() => openEdit(p)} aria-label={t("edit")} className="text-[#5EA8F5] hover:opacity-80"><MdEdit size={18} /></button>
										<button type="button" onClick={() => setToDelete(p.id)} aria-label={t("blogDelete")} className="text-[#B3B3B3] hover:text-danger"><MdDelete size={18} /></button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{posts.length === 0 && <p className="py-30 text-center text-14 text-[#999999]">{t("none")}</p>}
			</div>

			<Modal open={open} onClose={() => setOpen(false)} label={editId ? t("blogEdit") : t("blogNew")} className="w-full max-w-[720px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{editId ? t("blogEdit") : t("blogNew")}</h2>

					<div className="mb-14 grid grid-cols-1 gap-14 md:grid-cols-2">
						<FormField label={t("blogSlug")} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t("blogSlugHint")} maxLength={80} />
						<label className="block">
							<span className="mb-6 block text-16 text-[#999999]">{t("blogImage")}</span>
							<select value={PRESET_IMAGES.includes(image) ? image : "custom"} onChange={(e) => setImage(e.target.value === "custom" ? "" : e.target.value)} className={field}>
								{PRESET_IMAGES.map((src) => <option key={src} value={src}>{src.split("/").pop()}</option>)}
								<option value="custom">{t("blogImageCustom")}</option>
							</select>
						</label>
					</div>
					{!PRESET_IMAGES.includes(image) && (
						<div className="mb-14"><FormField label={t("blogImageUrl")} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" maxLength={300} /></div>
					)}

					<label className="mb-16 flex items-center gap-10 text-16 text-[#666666]">
						<input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-[18px] w-[18px] accent-primaryColor" />
						{t("blogPublished")}
					</label>

					{LANGS.map((l) => (
						<div key={l.key} className="mb-20 rounded-12 border border-[#F0F0F0] p-14">
							<p className="mb-10 text-14 font-semibold text-[#999999]">{l.label}</p>
							<div className="mb-10"><FormField label={t("blogArticleTitle")} value={title[l.key]} onChange={(e) => setTitle({ ...title, [l.key]: e.target.value })} maxLength={200} /></div>
							<div className="mb-10">
								<span className="mb-6 block text-16 text-[#999999]">{t("blogExcerpt")}</span>
								<textarea value={excerpt[l.key]} onChange={(e) => setExcerpt({ ...excerpt, [l.key]: e.target.value })} maxLength={400} rows={2} className={area} />
							</div>
							<div>
								<span className="mb-6 block text-16 text-[#999999]">{t("blogBody")}</span>
								<textarea value={bodyText[l.key]} onChange={(e) => setBodyText({ ...bodyText, [l.key]: e.target.value })} rows={6} placeholder={t("blogBodyHint")} className={area} />
							</div>
						</div>
					))}

					<div className="mt-10 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("blogDelete")} text={t("blogConfirmDelete")} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
		</div>
	);
}
