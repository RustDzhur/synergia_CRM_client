// Точка входа файлового хранилища. Сейчас используется локальный диск (LOCAL_STORAGE_ROOT).
// Прежняя реализация Firebase осталась в ./firebase.ts — её можно вернуть, поменяв re-export ниже.
export {
    checkBucket,
    deleteObject,
    getObject,
    putObject,
    storageConfigured,
    storageProblem,
} from "./local";
