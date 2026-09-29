import type { MessagingChannel } from "@/types/integrations";

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

// Каналы, в которые можно отправлять фото, файлы и голосовые (совпадает с серверным списком)
export const MEDIA_CHANNELS: MessagingChannel[] = ["telegram", "viber"];

export const sizeLabel = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

// Расширение записи: Chrome пишет WebM, Safari — MP4 (m4a). Имя должно совпадать с содержимым,
// иначе и Telegram, и наш сервер определят тип файла неправильно.
export function voiceExt(mimeType: string) {
	const m = (mimeType || "").toLowerCase();
	if (m.includes("mp4")) return "m4a";
	if (m.includes("ogg")) return "ogg";
	if (m.includes("mpeg")) return "mp3";
	return "webm";
}
