import { create } from "zustand";

interface SignUpFormData {
	firstname: string;
	lasttname: string;
	email: string;
	password: string;
}

interface SignInFormData {
	email: string;
	password: string;
}

interface AuthStore {
	isSigningIn: boolean;
	isSigningUp: boolean;
	timeoutId?: NodeJS.Timeout;
	signIn: (data: SignInFormData) => Promise<void>;
	signUp: (data: SignUpFormData) => Promise<void>;
}

const useAuthStore = create<AuthStore>((set) => {
	const isClientSide = typeof window !== "undefined";

	const tokenFromLocalStorage = isClientSide
		? localStorage.getItem("token")
		: null;

	const initialIsSigningIn =
		tokenFromLocalStorage !== null && tokenFromLocalStorage !== undefined;

	set({
		isSigningIn: initialIsSigningIn,
		isSigningUp: false,
		timeoutId: undefined,
	});

	return {
		isSigningIn: initialIsSigningIn,
		isSigningUp: false,
		timeoutId: undefined,
		signIn: async (data: SignInFormData) => {
			set({ isSigningIn: true });

			try {
				const response = await fetch(
					"https://synergia-crm-server.onrender.com/api/signin",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(data),
					}
				);

				if (!response.ok) {
					throw new Error("Signin failed");
				}

				const responseData = await response.json();

				localStorage.setItem("token", responseData.user.token);

				const timeoutId = setTimeout(() => {
					localStorage.setItem("token", "");
					set({ isSigningIn: false });
				}, 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);

				set({ timeoutId });
			} catch (error) {
				console.error("Signin error:", error);
			}
		},
		signUp: async (data: SignUpFormData) => {
			set({ isSigningUp: true });

			try {
				const response = await fetch(
					"https://synergia-crm-server.onrender.com/api/signup",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(data),
					}
				);

				if (!response.ok) {
					throw new Error("Signup failed");
				}
			} catch (error) {
				console.error("Signup error:", error);
			} finally {
				set({ isSigningUp: false });
			}
		},
	};
});

export default useAuthStore;
