import { Schema, models, model, deleteModel } from "mongoose";

// В dev-режиме Next перезагружает модули, а Mongoose помнит модель со старой схемой — новые поля
// не сохранялись бы до перезапуска сервера. Поэтому вне продакшена модель пересоздаётся.
export function registerModel(name: string, schema: Schema) {
    if (models[name] && process.env.NODE_ENV !== "production") deleteModel(name);
    return models[name] || model(name, schema);
}
