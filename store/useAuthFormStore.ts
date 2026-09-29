import {create} from "zustand";

type AuthFormStore = {
  isSignInFormOpen: boolean;
  isSignUpFormOpen: boolean;
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

  openSignInForm: () => set({ isSignInFormOpen: true, isSignUpFormOpen: false }),
  closeSignInForm: () => set({ isSignInFormOpen: false }),

  openSignUpForm: () => set({ isSignUpFormOpen: true, isSignInFormOpen: false }),
  closeSignUpForm: () => set({ isSignUpFormOpen: false }),

  toggleSignInForm: () => set((state) => ({ isSignInFormOpen: !state.isSignInFormOpen })),
  toggleSignUpForm: () => set((state) => ({ isSignUpFormOpen: !state.isSignUpFormOpen })),
}));

export default useAuthFormStore;
