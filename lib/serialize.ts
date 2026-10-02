// Prisma отдаёт поле id, а Mongoose отдавал _id. Фронтенд доменных объектов (контакты, сделки,
// стадии, задачи, документы…) обращается к _id. Чтобы не переписывать фронтенд, добавляем _id = id;
// поле id тоже остаётся — оно не мешает и пригодится после полного перехода на Postgres.
export function toDTO<T extends { id: string }>(obj: T): T & { _id: string } {
    return { ...obj, _id: obj.id };
}

export function toDTOs<T extends { id: string }>(arr: T[]): Array<T & { _id: string }> {
    return arr.map(toDTO);
}
