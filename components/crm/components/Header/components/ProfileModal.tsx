"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdPhotoCamera } from "react-icons/md";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import { useScrollLock } from "@/utils/useScrollLock";
import { fileToAvatar, MAX_AVATAR_FILE_BYTES } from "@/utils/avatar";
import Avatar from "@/components/crm/components/Main/shared/Avatar";

interface FormState {
	firstname: string;
	lastname: string;
	phone: string;
	position: string;
	city: string;
	country: string;
}

const EMPTY_FORM: FormState = { firstname: "", lastname: "", phone: "", position: "", city: "", country: "" };

// Окно «Settings» из меню пользователя: личные данные и аватарка.
// Рендерится один раз в crm/layout.tsx, открывается через useCurrentUserStore.
export default function ProfileModal() {
	const t = useTranslations("profile");
	const { user, isProfileOpen, closeProfile, updateUser } = useCurrentUserStore();
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [avatar, setAvatar] = useState("");
	const [saving, setSaving] = useState(false);
	const [mounted, setMounted] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => setMounted(true), []);
	useScrollLock(isProfileOpen);

	// при каждом открытии подставляем актуальные данные пользователя
	useEffect(() => {
		if (!isProfileOpen || !user) return;
		setForm({
			firstname: user.firstname ?? "",
			lastname: user.lastname ?? "",
			phone: user.phone ?? "",
			position: user.position ?? "",
			city: user.city ?? "",
			country: user.country ?? "",
		});
		setAvatar(user.avatarUrl ?? "");
	}, [isProfileOpen, user]);

	useEffect(() => {
		if (!isProfileOpen) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeProfile();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isProfileOpen, closeProfile]);

	if (!mounted) return null;

	const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm((prev) => ({ ...prev, [key]: e.target.value }));

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
		if (!file) return;
		if (!file.type.startsWith("image/")) return void toast.error(t("notImage"));
		if (file.size > MAX_AVATAR_FILE_BYTES) return void toast.error(t("tooBig"));
		try {
			setAvatar(await fileToAvatar(file));
		} catch {
			toast.error(t("notImage"));
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.firstname.trim() || !form.lastname.trim()) return void toast.error(t("nameRequired"));
		setSaving(true);
		const ok = await updateUser({ ...form, avatarUrl: avatar });
		setSaving(false);
		if (ok) {
			toast.success(t("saved"));
			closeProfile();
		} else {
			toast.error(t("error"));
		}
	}

	const initials = `${form.firstname[0] ?? ""}${form.lastname[0] ?? ""}`.toUpperCase();
	const input =
		"fs-field h-40 w-full px-12 text-13 outline-none transition-colors";
	const label = "mb-6 block text-12 text-[#8c948b]";

	return createPortal(
		<div
			onMouseDown={(e) => e.target === e.currentTarget && closeProfile()}
			aria-hidden={!isProfileOpen}
			className={`fixed inset-0 z-[60] flex items-center justify-center bg-modalBG p-16 transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
				isProfileOpen ? "visible opacity-100" : "invisible opacity-0"
			}`}>
			<form
				onSubmit={handleSubmit}
				role="dialog"
				aria-modal="true"
				aria-label={t("title")}
				className={`fs-popover fs-scroll relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto p-20 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
					isProfileOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-[16px] scale-95 opacity-0"
				}`}>
				<button
					type="button"
					onClick={closeProfile}
					aria-label={t("cancel")}
					className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black">
					<MdClose size={24} />
				</button>

				<h2 className="mb-20 text-24 font-medium text-black">{t("title")}</h2>

				<div className="mb-24 flex items-center gap-20">
					<div className="relative h-[84px] w-[84px] shrink-0">
						<Avatar src={avatar} initials={initials} size={84} className="flex text-24 shadow-circleShadow" />
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							aria-label={t("uploadPhoto")}
							className="absolute -bottom-2 -right-2 flex h-30 w-30 items-center justify-center rounded-50 bg-[#c6ff4d] text-[#0a0c0b] shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-transform hover:scale-110">
							<MdPhotoCamera size={18} />
						</button>
						<input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
					</div>
					<div className="flex flex-col items-start gap-8">
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							className="text-16 font-medium text-primaryColor transition-opacity hover:opacity-80">
							{t("uploadPhoto")}
						</button>
						{avatar && (
							<button
								type="button"
								onClick={() => setAvatar("")}
								className="text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
								{t("removePhoto")}
							</button>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 gap-16 md:grid-cols-2">
					<div>
						<label className={label}>{t("firstname")}</label>
						<input className={input} value={form.firstname} onChange={setField("firstname")} maxLength={100} />
					</div>
					<div>
						<label className={label}>{t("lastname")}</label>
						<input className={input} value={form.lastname} onChange={setField("lastname")} maxLength={100} />
					</div>
					<div className="md:col-span-2">
						<label className={label}>{t("email")}</label>
						<input className={`${input} cursor-not-allowed text-[#8c948b]`} value={user?.email ?? ""} readOnly />
					</div>
					<div>
						<label className={label}>{t("phone")}</label>
						<input className={input} value={form.phone} onChange={setField("phone")} maxLength={100} type="tel" />
					</div>
					<div>
						<label className={label}>{t("position")}</label>
						<input className={input} value={form.position} onChange={setField("position")} maxLength={100} />
					</div>
					<div>
						<label className={label}>{t("city")}</label>
						<input className={input} value={form.city} onChange={setField("city")} maxLength={100} />
					</div>
					<div>
						<label className={label}>{t("country")}</label>
						<input className={input} value={form.country} onChange={setField("country")} maxLength={100} />
					</div>
				</div>

				<div className="mt-24 flex justify-end gap-12">
					<button
						type="button"
						onClick={closeProfile}
						className="fs-btn fs-btn-ghost h-40">
						{t("cancel")}
					</button>
					<button
						type="submit"
						disabled={saving}
						className="fs-btn fs-btn-primary h-40 disabled:opacity-60">
						{saving ? t("saving") : t("save")}
					</button>
				</div>
			</form>
		</div>,
		document.body
	);
}
