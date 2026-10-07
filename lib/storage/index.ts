// Точка входа файлового хранилища. Сейчас используется локальный диск (LOCAL_STORAGE_ROOT).
export {
    checkBucket,
    deleteObject,
    getObject,
    putObject,
    storageConfigured,
    storageProblem,
} from "./local";
