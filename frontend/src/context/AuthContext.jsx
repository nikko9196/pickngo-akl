import { createContext, useEffect, useState } from "react";

import {
  continueAsGuest,
  getCurrentUser,
  login,
  loginWithGoogle,
  register,
} from "../api/auth";

const AUTH_STORAGE_KEY = "have-a-byte-auth";

const AuthContext = createContext(null);

function readStoredAuth() {
  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return { token: "", user: null };
  }

  try {
    return JSON.parse(stored);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return { token: "", user: null };
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => readStoredAuth());
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function hydrateUser() {
      if (!authState.token) {
        setIsAuthReady(true);
        return;
      }

      try {
        const { user } = await getCurrentUser(authState.token);

        if (!ignore) {
          const nextState = { token: authState.token, user };
          setAuthState(nextState);
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
        }
      } catch {
        if (!ignore) {
          setAuthState({ token: "", user: null });
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } finally {
        if (!ignore) {
          setIsAuthReady(true);
        }
      }
    }

    hydrateUser();

    return () => {
      ignore = true;
    };
  }, [authState.token]);

  async function handleAuthRequest(requestFn, payload) {
    const result = await requestFn(payload);
    const nextState = { token: result.token, user: result.user };
    setAuthState(nextState);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
    return result.user;
  }

  const value = {
    isAuthenticated: Boolean(authState.token && authState.user),
    isAuthReady,
    token: authState.token,
    user: authState.user,
    login: (payload) => handleAuthRequest(login, payload),
    register: (payload) => handleAuthRequest(register, payload),
    loginWithGoogle: (credential) =>
      handleAuthRequest(() => loginWithGoogle(credential)),
    continueAsGuest: () => handleAuthRequest(continueAsGuest),
    logout: () => {
      setAuthState({ token: "", user: null });
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
