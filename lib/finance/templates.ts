// Справочник шаблонов оформления финансовых документов. Отдельный файл без единого импорта: его читает и
// серверный рендер PDF (lib/finance/layouts.ts), и интерфейс — а тянуть pdfkit в браузерный бандл нельзя.
// accent — цвет линий и заголовков, tint — подложка блоков, variant — как шаблон располагает блоки
// (по нему рисуется миниатюра в выборе шаблона и он же объясняет разницу между соседними вариантами).

export type TemplateVariant = "classic" | "band" | "plain" | "boxed" | "sidebar" | "banner" | "twocol" | "compact" | "center" | "grid";

export interface TemplateDef {
    id: string;
    accent: string;
    tint: string;
    margin: number;
    variant: TemplateVariant;
}

export const TEMPLATES: TemplateDef[] = [
    { id: "classic", accent: "#333333", tint: "#F5F7FA", margin: 50, variant: "classic" },
    { id: "modern", accent: "#2DBEF0", tint: "#EAF7FD", margin: 50, variant: "band" },
    { id: "minimal", accent: "#111111", tint: "#FFFFFF", margin: 62, variant: "plain" },
    { id: "boxed", accent: "#4D4D4D", tint: "#FAFAFA", margin: 50, variant: "boxed" },
    { id: "sidebar", accent: "#14939F", tint: "#E8F5F6", margin: 50, variant: "sidebar" },
    { id: "banner", accent: "#2B96C8", tint: "#EAF3FA", margin: 50, variant: "banner" },
    { id: "twocol", accent: "#1D6BA5", tint: "#EEF5FF", margin: 50, variant: "twocol" },
    { id: "compact", accent: "#5A5A5A", tint: "#F7F7F7", margin: 42, variant: "compact" },
    { id: "elegant", accent: "#7A6A55", tint: "#FAF7F2", margin: 56, variant: "center" },
    { id: "swiss", accent: "#111111", tint: "#EFEFEF", margin: 50, variant: "grid" },
];

export const TEMPLATE_IDS = TEMPLATES.map((x) => x.id);
export const isTemplate = (v: unknown): v is string => typeof v === "string" && TEMPLATE_IDS.includes(v);
export const templateDef = (id?: string | null): TemplateDef => TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
