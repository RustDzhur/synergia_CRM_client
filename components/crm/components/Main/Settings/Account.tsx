"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCamera } from "react-icons/tb";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import { fileToAvatar, MAX_AVATAR_FILE_BYTES } from "@/app/utils/avatar";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import FormField from "../shared/FormField";
import SettingsTabs from "./SettingsTabs";
import Avatar from "../shared/Avatar";

const PROFILE_KEYS = [
	"firstname", "lastname", "phone", "role", "department", "postCode", "languages", "timezone",
	"city", "state", "country", "company",
] as const;
type ProfileKey = (typeof PROFILE_KEYS)[number];
type ProfileForm = Record<ProfileKey, string>;

const EMPTY: ProfileForm = Object.fromEntries(PROFILE_KEYS.map((k) => [k, ""])) as ProfileForm;

const SECTION_TITLE = "mb-10 text-15 font-semibold text-[#f1f4ee]";
const BUTTON = "fs-btn fs-btn-primary h-40 w-full text-13 disabled:opacity-60";

// Settings → Account (/crm/settings). Сетка как в Figma:
//  desktop: карточка вкладок | Basic Information | вертикальная линия | Additional Information, Job, Change Password
//  tablet:  слева вкладки и Basic Information, справа остальное
//  mobile:  одна колонка
export default function Account() {
	const t = useTranslations("settings");
	const { user, updateUser, changePassword } = useCurrentUserStore();
	const [form, setForm] = useState<ProfileForm>(EMPTY);
	const [saving, setSaving] = useState(false);
	const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
	const [pwBusy, setPwBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	// подставляем данные пользователя, когда они загрузились или сохранились
	useEffect(() => {
		if (!user) return;
		setForm(Object.fromEntries(PROFILE_KEYS.map((k) => [k, user[k] ?? ""])) as ProfileForm);
	}, [user]);

	const dirty = user !== null && PROFILE_KEYS.some((k) => form[k] !== (user[k] ?? ""));
	const set = (key: ProfileKey) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

	async function saveProfile(e?: React.FormEvent) {
		e?.preventDefault();
		if (!form.firstname.trim() || !form.lastname.trim()) return void toast.error(t("nameRequired"));
		setSaving(true);
		const ok = await updateUser(form);
		setSaving(false);
		ok ? toast.success(t("saved")) : toast.error(t("error"));
	}

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) return void toast.error(t("notImage"));
		if (file.size > MAX_AVATAR_FILE_BYTES) return void toast.error(t("tooBig"));
		try {
			const ok = await updateUser({ avatarUrl: await fileToAvatar(file) });
			ok ? toast.success(t("saved")) : toast.error(t("error"));
		} catch {
			toast.error(t("notImage"));
		}
	}

	async function submitPassword(e: React.FormEvent) {
		e.preventDefault();
		const { current, next, confirm } = passwords;
		if (!current || !next || !confirm) return void toast.error(t("passwordFill"));
		if (next !== confirm) return void toast.error(t("passwordMismatch"));
		if (next.length < 8) return void toast.error(t("passwordWeak"));
		setPwBusy(true);
		const result = await changePassword(current, next);
		setPwBusy(false);
		if (result === "ok") {
			setPasswords({ current: "", next: "", confirm: "" });
			toast.success(t("passwordChanged"));
		} else {
			toast.error(result === "wrong" ? t("passwordWrong") : result === "weak" ? t("passwordWeak") : t("error"));
		}
	}

	const field = (key: ProfileKey, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
		<FormField label={label} value={form[key]} onChange={set(key)} maxLength={100} disabled={!user} {...extra} />
	);
	const setPw = (key: "current" | "next" | "confirm") => (e: React.ChangeEvent<HTMLInputElement>) =>
		setPasswords((p) => ({ ...p, [key]: e.target.value }));
	const initials = `${form.firstname[0] ?? ""}${form.lastname[0] ?? ""}`.toUpperCase();

	const saveButton = dirty && (
		<button type="submit" disabled={saving} className={`${BUTTON} mt-20 animate-fade-in-up`}>
			{t("save")}
		</button>
	);

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="grid grid-cols-1 gap-y-20 md:grid-cols-2 md:gap-x-30 lg:grid-cols-[max-content_379px_349px] lg:gap-x-0">
				<SettingsTabs className="self-start md:col-start-1 md:row-start-1 md:justify-self-start" />

				{/* Basic Information */}
				<form onSubmit={saveProfile} className="md:col-start-1 md:row-start-2 lg:col-start-2 lg:row-start-1 lg:ml-30 lg:mr-50">
					<div className="relative mx-auto mb-20 h-[60px] w-[60px] lg:mb-30">
						<Avatar
							src={user?.avatarUrl}
							initials={initials}
							size={60}
							className="flex text-18"
							style={user?.avatarUrl ? undefined : { background: "rgba(198,255,77,0.14)", color: "#c6ff4d" }}
						/>
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							aria-label={t("uploadPhoto")}
							className="absolute -bottom-2 -right-2 flex h-24 w-24 items-center justify-center rounded-50 border border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.14)] text-[#c6ff4d] transition-transform hover:scale-110">
							<TbCamera size={13} />
						</button>
						<input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
					</div>
					<h2 className={SECTION_TITLE}>{t("basicInfo")}</h2>
					<div className="flex flex-col gap-15">
						{field("firstname", t("firstName"))}
						{field("lastname", t("lastName"))}
						<FormField label={t("email")} value={user?.email ?? ""} readOnly title={t("emailLocked")} className="cursor-not-allowed text-[#9AA396]" />
						{field("phone", t("phone"), { type: "tel" })}
						{field("role", t("role"))}
						{field("department", t("department"))}
						{field("postCode", t("postCode"))}
						{field("languages", t("languages"))}
						{field("timezone", t("timezone"))}
					</div>
					{saveButton}
				</form>

				{/* Additional Information / Job / Change Password */}
				<div className="md:col-start-2 md:row-span-2 md:row-start-1 lg:col-start-3 lg:row-span-1 lg:w-[349px] lg:border-l lg:border-inkLine lg:pl-40">
					<form onSubmit={saveProfile}>
						<h2 className={SECTION_TITLE}>{t("additionalInfo")}</h2>
						<div className="flex flex-col gap-15">
							{field("city", t("city"))}
							{field("state", t("state"))}
							{field("country", t("country"))}
						</div>
						<h2 className={`${SECTION_TITLE} mt-30`}>{t("job")}</h2>
						{field("company", t("company"))}
						{saveButton}
					</form>

					{/* Change Password — отдельная форма: своя кнопка и проверка старого пароля на сервере */}
					<form onSubmit={submitPassword} className="mt-30 border-t border-inkLine pt-20 md:border-0 md:pt-0">
						<h2 className={SECTION_TITLE}>{t("changePassword")}</h2>
						<div className="flex flex-col gap-15">
							<FormField label={t("previousPassword")} type="password" autoComplete="current-password" placeholder="*****" value={passwords.current} onChange={setPw("current")} maxLength={128} />
							<FormField label={t("newPassword")} type="password" autoComplete="new-password" placeholder="*****" value={passwords.next} onChange={setPw("next")} maxLength={128} />
							<FormField label={t("confirmPassword")} type="password" autoComplete="new-password" placeholder={t("newPasswordPlaceholder")} value={passwords.confirm} onChange={setPw("confirm")} maxLength={128} />
						</div>
						<button type="submit" disabled={pwBusy} className={`${BUTTON} mt-20`}>
							{t("changePassword")}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
