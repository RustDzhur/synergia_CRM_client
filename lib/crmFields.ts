// Списки полей, которые разрешено принимать от клиента (белые списки для POST/PATCH).
// Лежат здесь, а не в файлах маршрутов: Next.js не разрешает экспортировать из route.ts ничего, кроме обработчиков.

export const DEAL_TEXT_FIELDS = [
    "contactName", "companyName", "startDate", "endDate", "dealType", "responsible", "utm", "recurring",
] as const;

export const CONTACT_FIELDS = [
    "firstName", "lastName", "email", "phone", "company", "position", "website", "twitter", "facebook", "notes",
] as const;

export const COMPANY_FIELDS = [
    "name", "email", "field", "status", "code", "registrationDate",
    "authorisedPerson", "businessType", "ownershipForm", "address",
] as const;

// Полное имя контакта собирается из имени и фамилии; если их нет — берётся присланное поле name
export function contactFullName(fields: Record<string, string>, fallback?: unknown) {
    const joined = `${fields.firstName ?? ""} ${fields.lastName ?? ""}`.trim();
    if (joined) return joined;
    return typeof fallback === "string" ? fallback.trim().slice(0, 200) : "";
}

export const TASK_TEXT_FIELDS = ["title", "description", "deadline", "responsible"] as const;

export const EMPLOYEE_FIELDS = [
    "firstname", "lastname", "email", "workPhone", "internalPhone", "position", "department",
] as const;

// Экранирует спецсимволы регулярных выражений: строка поиска пользователя не должна становиться шаблоном
export function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
