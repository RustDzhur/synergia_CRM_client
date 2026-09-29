"use client";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy } from "react-icons/tb";

export default function CopyField({ label, value }: { label: string; value: string }) {
	const t = useTranslations("settings");
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(t("intCopied"));
		} catch {
			toast.error(t("intCopyFailed"));
		}
	}
	return (
		<div>
			<span className="mb-6 block text-12 text-[#8c948b]">{label}</span>
			<div className="flex items-stretch gap-8">
				<input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label} className="fs-field h-40 min-w-0 flex-1 px-12 text-13 outline-none" />
				<button type="button" onClick={copy} aria-label={t("intCopy")} className="flex w-40 shrink-0 items-center justify-center rounded-10 border border-inkLine text-[#8c948b] transition-colors hover:border-[rgba(198,255,77,0.35)] hover:text-[#c6ff4d]">
					<TbCopy size={17} />
				</button>
			</div>
		</div>
	);
}
