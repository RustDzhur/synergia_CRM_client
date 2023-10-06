import {create} from 'zustand';

interface SignUpFormData {
	username: string;
	password: string;
}

interface SignInFormData {
	username: string;
	password: string;
}

interface AuthStore {
  isSigningIn: boolean;
  isSigningUp: boolean;
  signIn: (data: SignInFormData) => Promise<void>;
  signUp: (data: SignUpFormData) => Promise<void>;
}

const useAuthStore = create<AuthStore>((set) => ({
  isSigningIn: false,
  isSigningUp: false,
  signIn: async (data: SignInFormData) => {
    // Set loading state
    set({ isSigningIn: true });

    try {
      // Make API call for signin
      const response = await fetch('https://synergia-crm-server.onrender.com/api/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      // Handle response
      if (!response.ok) {
        throw new Error('Signin failed');
      }

      // Handle successful signin, e.g., set user token in local storage, etc.
      // ...

    } catch (error) {
      // Handle error
      console.error('Signin error:', error);

    } finally {
      // Reset loading state
      set({ isSigningIn: false });
    }
  },
  signUp: async (data: SignUpFormData) => {
    // Set loading state
    set({ isSigningUp: true });

    try {
      // Make API call for signup
      const response = await fetch('https://synergia-crm-server.onrender.com/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      // Handle response
      if (!response.ok) {
        throw new Error('Signup failed');
      }

      // Handle successful signup, e.g., set user token in local storage, etc.
      // ...

    } catch (error) {
      // Handle error
      console.error('Signup error:', error);

    } finally {
      // Reset loading state
      set({ isSigningUp: false });
    }
  },
}));

export default useAuthStore;
