// Переключатель вкладок раздела (Deals / Contacts / Companies, Finanzen, Aufgaben …).
// В образце это ряд «пилюль» без общей подложки: активная залита акцентом, остальные обведены рамкой.
// На телефоне ряд прокручивается по горизонтали и выходит за поля страницы — так в него помещается больше вкладок.
export const TAB_BAR = "flex items-center gap-8";

// Одна вкладка. Высота 34px и скругление 999px — как у пилюль в образце.
export const TAB_ITEM =
	"flex h-34 shrink-0 items-center whitespace-nowrap rounded-50 border px-16 text-13 font-medium transition-colors duration-150";

// Активная вкладка: заливка акцентом, тёмный текст.
export const TAB_ITEM_ACTIVE = "border-[#7c93ff] bg-[#7c93ff] text-[#0b1120]";

// Обычная вкладка: рамка без заливки, при наведении светлеет текст.
export const TAB_ITEM_IDLE =
	"border-[rgba(255,255,255,0.10)] text-[#9aa7c9] hover:border-[rgba(255,255,255,0.20)] hover:text-[#edf2ff]";
