// Тексты управления комнатами офиса на четырёх языках интерфейса.
import { pickLang, type Lang } from "@/lib/finance/contractFields";

const D = {
	rooms: { en: "Rooms", ua: "Кімнати", de: "Räume", uz: "Xonalar" },
	title: { en: "Office rooms", ua: "Кімнати офісу", de: "Büroräume", uz: "Ofis xonalari" },
	hint: { en: "Add your own rooms next to the built-in ones (for example «Advertising» or «Research»). Drag a robot into a room, or choose the room when you hire it. Deleting a room moves its robots to «Office».", ua: "Додавайте власні кімнати поряд із готовими (наприклад «Реклама» чи «Дослідження»). Перетягніть робота в кімнату або виберіть кімнату при наймі. Видалення кімнати переносить її роботів в «Офіс».", de: "Fügen Sie eigene Räume zu den vorhandenen hinzu (z. B. «Werbung» oder «Recherche»). Ziehen Sie einen Roboter in einen Raum oder wählen Sie den Raum bei der Einstellung. Beim Löschen eines Raums ziehen die Roboter ins «Büro» um.", uz: "Tayyor xonalar yoniga o‘z xonalaringizni qo‘shing (masalan, «Reklama» yoki «Tadqiqot»). Robotni xonaga sudrang yoki yollashda xonani tanlang. Xonani o‘chirsangiz, robotlari «Ofis»ga ko‘chadi." },
	placeholder: { en: "Room name", ua: "Назва кімнати", de: "Raumname", uz: "Xona nomi" },
	add: { en: "Add room", ua: "Додати кімнату", de: "Raum hinzufügen", uz: "Xona qo‘shish" },
	rename: { en: "Rename", ua: "Перейменувати", de: "Umbenennen", uz: "Nomini o‘zgartirish" },
	remove: { en: "Delete", ua: "Видалити", de: "Löschen", uz: "O‘chirish" },
	save: { en: "Save", ua: "Зберегти", de: "Speichern", uz: "Saqlash" },
	none: { en: "No own rooms yet", ua: "Власних кімнат ще немає", de: "Noch keine eigenen Räume", uz: "Hali o‘z xonalaringiz yo‘q" },
	confirmRemove: { en: "Delete the room? Its robots move to «Office».", ua: "Видалити кімнату? Її роботи переїдуть в «Офіс».", de: "Raum löschen? Die Roboter ziehen ins «Büro».", uz: "Xonani o‘chirasizmi? Robotlari «Ofis»ga ko‘chadi." },
	limit: { en: "Limit reached", ua: "Досягнуто ліміт", de: "Limit erreicht", uz: "Chegaraga yetdi" },
	close: { en: "Close", ua: "Закрити", de: "Schließen", uz: "Yopish" },
} satisfies Record<string, Record<Lang, string>>;

export type RoomUiKey = keyof typeof D;
export const trRooms = (locale: string) => { const l = pickLang(locale); return (k: RoomUiKey) => D[k][l]; };
