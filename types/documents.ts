// Типы, общие для сервера и клиента раздела Online Documents
export type DocKind = "gdoc" | "gsheet" | "gslide" | "file";

export interface FolderDTO {
    id: string;
    name: string;
    parent: string | null;
}

export interface DocItemDTO {
    id: string;
    kind: DocKind;
    name: string;
    folder: string | null;
    archived: boolean;
    createdBy: string;
    url: string; // для Google-документов
    mime: string;
    size: number;
    imported: boolean; // файл перенесён из Диска и принадлежит пользователю: правка только в CRM
    modifiedAt: string;
    createdAt: string;
}

export interface DocsState {
    folders: FolderDTO[];
    docs: DocItemDTO[];
    // googleDocs — сколько документов ссылаются на файлы Google: при отключении аккаунта они
    // остаются в списке, поэтому интерфейс предупреждает об этом заранее
    drive: { configured: boolean; connected: boolean; email: string; googleDocs: number };
    storage: { configured: boolean; maxMb: number; quotaMb: number };
}
