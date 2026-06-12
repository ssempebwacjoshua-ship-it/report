import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const TOKEN_KEY = "sc_auth_token";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN_OPERATOR";
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, schoolCode?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        return res.json() as Promise<{ user: AuthUser }>;
      })
      .then(({ user: loaded }) => setUser(loaded))
      .catch(() => {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {
          /* noop */
        }
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string, schoolCode = "SCU-PREVIEW") {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, schoolCode }),
    });

    const body = (await res.json()) as { token?: string; user?: AuthUser; error?: string };

    if (!res.ok) {
      throw new Error(body.error ?? "Login failed. Check your credentials.");
    }

    const { token: newToken, user: newUser } = body as { token: string; user: AuthUser };
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
    } catch {
      /* noop */
    }
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
    setToken(null);
    setUser(null);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
