import { create } from "zustand";
import toast from "react-hot-toast";

interface SignUpFormData {
	firstname: string;
	lastname: string;
	email: string;
	password: string;
}

interface SignInFormData {
	email: string;
	password: string;
}

interface AuthStore {
	isAuthenticated: boolean;
	authChecked: boolean;
	isLoading: boolean;
	checkAuth: () => void;
	signIn: (data: SignInFormData) => Promise<boolean>;
	signUp: (data: SignUpFormData) => Promise<boolean>;
	logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
	isAuthenticated: false,
	authChecked: false,
	isLoading: false,

	checkAuth: () => {
		const token = localStorage.getItem("token");
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
			if (!response.ok) throw new Error("Signup failed");
			toast.success("Регистрация прошла успешно. Теперь войдите.");
			return true;
		} catch (error) {
			console.error("Signup error:", error);
			toast.error("Не удалось зарегистрироваться.");
			return false;
		} finally {
			set({ isLoading: false });
		}
	},

	logout: () => {
		localStorage.removeItem("token");
		set({ isAuthenticated: false });
	},
}));

export default useAuthStore;