import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getApiBaseUrl } from "../client/apiBase";

const TOKEN_KEY = "sc_auth_token";
const USER_KEY = "sc_auth_user";
const API_BASE = getApiBaseUrl();

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN_OPERATOR";
  isPlatformOwner?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, schoolCode: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readAuthBody(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { token?: string; user?: AuthUser; error?: string };
  } catch {
    throw new Error("API returned non-JSON response.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
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

    let cancelled = false;

    async function refreshSession() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          if (cancelled) return;
          if (res.status === 401) {
            try {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
            } catch {
              /* noop */
            }
            setToken(null);
            setUser(null);
            setLoading(false);
            return;
          }
          if (!res.ok) {
            throw new Error(`Auth check failed (${res.status}).`);
          }

          const { user: loaded } = (await res.json()) as { user: AuthUser };
          if (cancelled) return;
          setUser(loaded);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(loaded));
          } catch {
            /* noop */
          }
          setLoading(false);
          return;
        } catch {
          if (cancelled) return;
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
            continue;
          }

          setLoading(false);
          return;
        }
      }
    }

    void refreshSession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login(email: string, password: string, schoolCode: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, schoolCode }),
    });

    const body = (await readAuthBody(res)) as { token?: string; user?: AuthUser; error?: string };

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Invalid email or password.");
      }
      if (res.status >= 500) {
        throw new Error("Server configuration error.");
      }
      throw new Error(body.error ?? "Login failed. Check your credentials.");
    }

    const { token: newToken, user: newUser } = body as { token: string; user: AuthUser };
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } catch {
      /* noop */
    }
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* noop */
    }
    setToken(null);
    setUser(null);
    fetch(`${API_BASE}/api/auth/logout`, { method: "POST" }).catch(() => {});
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

