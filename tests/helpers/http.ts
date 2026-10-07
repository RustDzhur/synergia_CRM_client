import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "test-secret";

// Запрос от имени пользователя к обработчику маршрута напрямую (без сервера): тот же requireUser, права и тарифы.
export function asUser(userId: string, orgId?: string) {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET as string);
    return (path: string, method = "GET", body?: unknown) =>
        new Request(`http://localhost${path}`, {
            method,
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(orgId ? { "x-org-id": orgId } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
}

export const ctx = (id: string) => ({ params: { id } });
