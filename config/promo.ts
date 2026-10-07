// Программа «первые 500 клиентов — год бесплатно». Полный доступ (тариф professional) выдаёт вручную администратор после письма клиента
// с названием компании и адресом регистрации (кнопка «Год бесплатно» в админ-кабинете); отметка хранится в Organization.billing.promo.
export const PROMO = {
	seats: 500, // сколько мест в программе
	months: 12, // на какой срок выдаётся доступ
	plan: "professional" as const,
};

export interface PromoInfo { seats: number; taken: number; left: number; months: number; email: string }
