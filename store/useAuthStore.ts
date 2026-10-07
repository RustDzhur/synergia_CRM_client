import { create } from "zustand";
import { ORG_KEY } from "./crmApi";

export const DEMO_KEY = "crm.demo";

// Данные фирмы при регистрации по вкладке «Company»: имя человека там не спрашивают,
// поэтому аккаунт называется именем фирмы, а реквизиты уходят в настройки бухгалтерии
export interface SignUpCompany {
	name: string;
	taxNumber?: string;
	phone?: string;
	address?: string;
}

export interface SignUpFormData {
	firstname: string;
	lastname: string;
	email: string;
	password: string;
	company?: SignUpCompany;
	/** язык письма с кодом подтверждения */
	locale?: string;
	/** «ловушка для ботов»: человек это поле не видит, у него оно всегда пустое */
	website?: string;
}

/** Причина отказа от сервера: code — правило или ошибка, field — какое поле неверно, params — числа для текста (минимум символов и т.п.) */
export interface AuthFail { ok: false; code: string; field?: string; params?: Record<string, string | number>; email?: string }

interface SignInFormData {
	email: string;
	password: string;
}

// Срок действия токена лежит во второй части JWT (payload). Читаем её без проверки подписи:
// подпись всё равно проверит сервер, а нам нужно только понять, идти ли на страницу входа сразу.
function isExpired(token: string): boolean {
	try {
		const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
		return typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now();
	} catch {
		return true; // токен битый — считаем, что сессии нет
	}
}

// Сохранить токен входа; выбранная фирма принадлежит прежнему аккаунту, поэтому сбрасывается
function saveToken(token: string) {
	localStorage.setItem("token", token);
	try { localStorage.removeItem(ORG_KEY); localStorage.removeItem(DEMO_KEY); } catch { /* приватный режим */ }
}

interface AuthStore {
	isAuthenticated: boolean;
	authChecked: boolean;
	isLoading: boolean;
	checkAuth: () => void;
	/** Вход: при отказе возвращает причину (email_required, email_format, password_required, invalid_credentials, too_many, email_unverified, server) — текст показывает форма на языке человека */
	signIn: (data: SignInFormData) => Promise<{ ok: true } | AuthFail>;
	/** Регистрация: при отказе возвращает причину и поле; verify=true — на почту ушёл код, нужно его ввести */
	signUp: (data: SignUpFormData) => Promise<{ ok: true; verify?: boolean; email?: string } | AuthFail>;
	/** Подтверждение почты кодом из письма; при успехе человек сразу входит */
	verifyEmail: (email: string, code: string) => Promise<{ ok: true } | AuthFail>;
	resendCode: (email: string, locale: string) => Promise<{ ok: true } | AuthFail>;
	/** Демо без регистрации: сервер отдаёт токен своей заполненной копии фирмы. */
	startDemo: (locale: string) => Promise<{ ok: true } | { ok: false; code: string }>;
	logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
	isAuthenticated: false,
	authChecked: false,
	isLoading: false,

	checkAuth: () => {
		const token = localStorage.getItem("token");
		// Сессия живёт сутки, и просроченный токен лежит в браузере до первого запроса.
		// Срок проверяем здесь же по полезной нагрузке токена, чтобы не открывать кабинет впустую.
		if (token && isExpired(token)) {
			localStorage.removeItem("token");
			set({ isAuthenticated: false, authChecked: true });
			return;
		}
		set({ isAuthenticated: Boolean(token), authChecked: true });
	},

	signIn: async (data) => {
		set({ isLoading: true });
		try {
			const response = await fetch("/api/auth/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				// 5xx — проблема сервера (не заданы переменные окружения, база недоступна): пароль тут ни при чём
				if (response.status >= 500) return { ok: false, code: "server" };
				const body = (await response.json().catch(() => ({}))) as { code?: string; field?: string; email?: string };
				return { ok: false, code: body.code ?? "invalid_credentials", field: body.field, email: body.email };
			}
			saveToken((await response.json()).token);
			set({ isAuthenticated: true, authChecked: true });
			return { ok: true };
		} catch (error) {
			console.error("Signin error:", error);
			return { ok: false, code: "server" };
		} finally {
			set({ isLoading: false });
		}
	},

	signUp: async (data) => {
		set({ isLoading: true });
		try {
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			const body = (await response.json().catch(() => ({}))) as { code?: string; field?: string; params?: Record<string, string | number>; verify?: boolean; email?: string };
			if (!response.ok) {
				console.error("Signup rejected:", response.status, body.code ?? "");
				return { ok: false, code: body.code ?? "generic", field: body.field, params: body.params };
			}
			return { ok: true, verify: !!body.verify, email: body.email };
		} catch (error) {
			console.error("Signup error:", error);
			return { ok: false, code: "generic" };
		} finally {
			set({ isLoading: false });
		}
	},

	verifyEmail: async (email, code) => {
		set({ isLoading: true });
		try {
			const response = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
			const body = (await response.json().catch(() => ({}))) as { token?: string; code?: string };
			if (!response.ok || !body.token) return { ok: false, code: body.code ?? "server" };
			saveToken(body.token);
			set({ isAuthenticated: true, authChecked: true });
			return { ok: true };
		} catch {
			return { ok: false, code: "server" };
		} finally {
			set({ isLoading: false });
		}
	},

	resendCode: async (email, locale) => {
		try {
			const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, locale }) });
			if (response.ok) return { ok: true };
			const body = (await response.json().catch(() => ({}))) as { code?: string };
			return { ok: false, code: body.code ?? "server" };
		} catch {
			return { ok: false, code: "server" };
		}
	},

	startDemo: async (locale) => {
		set({ isLoading: true });
		try {
			const res = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
			const body = (await res.json().catch(() => ({}))) as { token?: string; code?: string };
			if (!res.ok || !body.token) return { ok: false, code: body.code ?? "generic" };
			localStorage.setItem("token", body.token);
			localStorage.setItem(DEMO_KEY, "1");
			try { localStorage.removeItem(ORG_KEY); } catch { /* приватный режим */ }
			set({ isAuthenticated: true, authChecked: true });
			return { ok: true };
		} catch {
			return { ok: false, code: "generic" };
		} finally {
			set({ isLoading: false });
		}
	},

	logout: () => {
		// выход из демо стирает его копию фирмы на сервере (следующий посетитель получит исходную)
		try {
			if (localStorage.getItem(DEMO_KEY)) {
				void fetch("/api/demo", { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, keepalive: true });
				localStorage.removeItem(DEMO_KEY);
			}
		} catch { /* приватный режим */ }
		localStorage.removeItem("token");
		// выбранная фирма принадлежит прежнему аккаунту: следующий вход в этом браузере не должен её унаследовать
		try { localStorage.removeItem(ORG_KEY); } catch { /* приватный режим */ }
		set({ isAuthenticated: false });
	},
}));

export default useAuthStore;