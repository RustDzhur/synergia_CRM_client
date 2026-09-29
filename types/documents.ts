// Типы, общие для сервера и клиента раздела Online Documents
export type DocKind = "gdoc" | "gsheet" | "gslide" | "file";
// Внешнее хранилище документа: Google Drive, OneDrive или пусто — файл загружен к нам
export type CloudKind = "" | "google" | "onedrive";

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
    url: string; // для документов во внешнем хранилище
    mime: string;
    size: number;
    imported: boolean; // файл перенесён из внешнего хранилища и принадлежит пользователю: правка только в CRM
    cloud: CloudKind; // где живёт документ: у нас (""), в Google Drive или в OneDrive
    onDrive: boolean; // cloud !== "" — документ живёт не в нашем хранилище (для фильтров и вкладок)
    modifiedAt: string;
    createdAt: string;
}

export interface DocsState {
    folders: FolderDTO[];
    docs: DocItemDTO[];
    // googleDocs — сколько документов ссылаются на файлы Google: при отключении аккаунта они
    // остаются в списке, поэтому интерфейс предупреждает об этом заранее
    drive: { configured: boolean; connected: boolean; email: string; googleDocs: number };
    onedrive: { configured: boolean; connected: boolean; email: string; docs: number };
    storage: { configured: boolean; maxMb: number; quotaMb: number; usedMb: number };
}
