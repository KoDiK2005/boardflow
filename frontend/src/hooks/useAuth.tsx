import { createContext, ReactNode, useContext, useState } from "react";
import { api } from "../api/client";
import { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  function persist(token: string, user: User) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.token, data.user);
  }

  async function register(email: string, password: string, name: string) {
    const { data } = await api.post("/auth/register", { email, password, name });
    persist(data.token, data.user);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
