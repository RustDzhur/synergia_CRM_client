import { create } from "zustand";
import toast from "react-hot-toast";
import { ORG_KEY } from "./crmApi";

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
}

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

interface AuthStore {
	isAuthenticated: boolean;
	authChecked: boolean;
	isLoading: boolean;
	checkAuth: () => void;
	signIn: (data: SignInFormData) => Promise<boolean>;
	/** Регистрация: при отказе возвращает код причины (name_required, email_invalid, password_short, email_taken, generic) — текст показывает форма на языке человека */
	signUp: (data: SignUpFormData) => Promise<{ ok: true } | { ok: false; code: string }>;
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
				// 401 — неверные данные; 5xx — проблема сервера (не заданы переменные окружения, база недоступна): пароль тут ни при чём
				const serverProblem = response.status >= 500;
				toast.error(
					serverProblem
						? "Сервер недоступен или не настроен. Откройте /api/health, чтобы увидеть причину."
						: "Не удалось войти. Проверьте email и пароль."
				);
				return false;
			}
			const responseData = await response.json();
			localStorage.setItem("token", responseData.token);
			try { localStorage.removeItem(ORG_KEY); } catch { /* приватный режим */ }
			set({ isAuthenticated: true, authChecked: true });
			return true;
		} catch (error) {
			console.error("Signin error:", error);
			toast.error("Не удалось войти. Проверьте email и пароль.");
			return false;
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
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { code?: string };
				console.error("Signup rejected:", response.status, body.code ?? "");
				return { ok: false, code: body.code ?? "generic" };
			}
			return { ok: true };
		} catch (error) {
			console.error("Signup error:", error);
			return { ok: false, code: "generic" };
		} finally {
			set({ isLoading: false });
		}
	},

	logout: () => {
		localStorage.removeItem("token");
		// выбранная фирма принадлежит прежнему аккаунту: следующий вход в этом браузере не должен её унаследовать
		try { localStorage.removeItem(ORG_KEY); } catch { /* приватный режим */ }
		set({ isAuthenticated: false });
	},
}));

export default useAuthStore;