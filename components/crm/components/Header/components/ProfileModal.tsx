"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdPhotoCamera } from "react-icons/md";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";

const AVATAR_SIZE = 256;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface FormState {
	firstname: string;
	lastname: string;
	phone: string;
	position: string;
	city: string;
	country: string;
}

const EMPTY_FORM: FormState = { firstname: "", lastname: "", phone: "", position: "", city: "", country: "" };

// Обрезает картинку по центру до квадрата 256×256 и сжимает в JPEG — в базу уходит ~20–40 КБ.
async function fileToAvatar(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = AVATAR_SIZE;
		canvas.height = AVATAR_SIZE;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas");
		ctx.fillStyle = "#ffffff"; // у PNG с прозрачностью фон иначе станет чёрным
		ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
		const side = Math.min(img.width, img.height);
		ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
		return canvas.toDataURL("image/jpeg", 0.85);
	} finally {
		URL.revokeObjectURL(url);
	}
}

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
		if (file.size > MAX_FILE_BYTES) return void toast.error(t("tooBig"));
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
		"h-50 w-full rounded-8 bg-[#FBFBFB] px-16 text-16 text-black shadow-custom border border-[#E6E6E6] outline-none transition-colors duration-200 focus:border-[#5EA8F5]";
	const label = "mb-6 block text-14 text-[#999999]";

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
				className={`relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
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
						<div className="flex h-full w-full items-center justify-center overflow-hidden rounded-50 bg-[#D9D9D9] text-24 font-medium text-white shadow-circleShadow">
							{avatar ? (
								<img src={avatar} alt="" className="h-full w-full object-cover" />
							) : (
								initials
							)}
						</div>
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							aria-label={t("uploadPhoto")}
							className="absolute -bottom-2 -right-2 flex h-32 w-32 items-center justify-center rounded-50 bg-primaryColor text-white shadow-custom transition-transform hover:scale-110">
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
								className="text-14 text-[#999999] transition-colors hover:text-black">
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
						<input className={`${input} cursor-not-allowed text-[#999999]`} value={user?.email ?? ""} readOnly />
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
						className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">
						{t("cancel")}
					</button>
					<button
						type="submit"
						disabled={saving}
						className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
						{saving ? t("saving") : t("save")}
					</button>
				</div>
			</form>
		</div>,
		document.body
	);
}
