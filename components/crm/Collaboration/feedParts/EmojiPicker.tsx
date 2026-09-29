"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbMoodSmile } from "react-icons/tb";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

// Палитра для вставки в текст записи: сгруппирована по смыслу, чтобы нужное находилось глазами.
// Своего поиска нет намеренно — набор небольшой и обозримый.
const EMOJI_GROUPS: Array<{ key: string; items: string[] }> = [
	{ key: "smileys", items: ["😀", "😄", "😉", "😊", "🙂", "😍", "🤔", "😅", "😎", "🙌", "🤝", "🙏"] },
	{ key: "work", items: ["👍", "👏", "✅", "❗", "🔥", "💡", "📌", "📅", "⏰", "📈", "💰", "🧾"] },
	{ key: "marks", items: ["🎉", "🚀", "⭐", "❤️", "☕", "🌍", "📞", "✉️", "📎", "🔗", "⚠️", "🎯"] },
];

// Выбор смайлика для текста записи
export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
	const t = useTranslations("collab");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-expanded={open}
				aria-label={t("emoji")}
				onClick={() => setOpen((v) => !v)}
				className={`flex h-34 items-center gap-8 rounded-10 border px-12 text-12 transition-colors ${open ? "border-inkAccentLine text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
				<TbMoodSmile size={15} aria-hidden />
				{t("emoji")}
			</button>
			<Dropdown open={open} className="bottom-full left-0 mb-8 w-[268px]">
				<div className="fs-popover fs-scroll max-h-[240px] overflow-y-auto p-10">
					{EMOJI_GROUPS.map((group) => (
						<div key={group.key} className="mb-8 last:mb-0">
							<p className="mb-4 px-4 text-10 uppercase tracking-[0.12em] text-[#9AA396]">{t(`emoji_${group.key}`)}</p>
							<div className="flex flex-wrap gap-2">
								{group.items.map((emoji) => (
									<button
										key={emoji}
										type="button"
										onClick={() => onPick(emoji)}
										className="flex h-30 w-30 items-center justify-center rounded-8 text-18 transition-colors hover:bg-[rgba(255,255,255,0.08)]">
										{emoji}
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			</Dropdown>
		</div>
	);
}
