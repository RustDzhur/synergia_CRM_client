import {create} from "zustand";

type AuthFormStore = {
  isSignInFormOpen: boolean;
  isSignUpFormOpen: boolean;
  /** почта, для которой ждём код подтверждения; пока задана, в окне входа показывается ввод кода */
  verifyEmail: string | null;
  openVerify: (email: string) => void;
  openSignInForm: () => void;
  closeSignInForm: () => void;
  openSignUpForm: () => void;
  closeSignUpForm: () => void;
  toggleSignInForm: () => void;
  toggleSignUpForm: () => void;
};

const useAuthFormStore = create<AuthFormStore>((set) => ({
  isSignInFormOpen: false,
  isSignUpFormOpen: false,
  verifyEmail: null,

  openVerify: (email) => set({ verifyEmail: email, isSignInFormOpen: true, isSignUpFormOpen: false }),
  openSignInForm: () => set({ isSignInFormOpen: true, isSignUpFormOpen: false }),
  closeSignInForm: () => set({ isSignInFormOpen: false, verifyEmail: null }),

  openSignUpForm: () => set({ isSignUpFormOpen: true, isSignInFormOpen: false, verifyEmail: null }),
  closeSignUpForm: () => set({ isSignUpFormOpen: false }),

  toggleSignInForm: () => set((state) => ({ isSignInFormOpen: !state.isSignInFormOpen, verifyEmail: null })),
  toggleSignUpForm: () => set((state) => ({ isSignUpFormOpen: !state.isSignUpFormOpen, verifyEmail: null })),
}));

export default useAuthFormStore;
