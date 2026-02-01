import { create } from "zustand";
import { storage } from "@/utils/storage";
import { API_CONFIG } from "@/config/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const API_URL = API_CONFIG.AUTH_URL;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      await storage.setItem("token", data.token);
      set({ user: data.user, token: data.token });
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  register: async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      await storage.setItem("token", data.token);
      set({ user: data.user, token: data.token });
    } catch (error) {
      console.error("Register error:", error);
      throw error;
    }
  },

  logout: async () => {
    await storage.deleteItem("token");
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    try {
      const token = await storage.getItem("token");

      if (!token) {
        set({ isLoading: false });
        return;
      }

      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        set({ user: data.user, token, isLoading: false });
      } else {
        await storage.deleteItem("token");
        set({ user: null, token: null, isLoading: false });
      }
    } catch (error) {
      console.error("Auth check error:", error);
      set({ isLoading: false });
    }
  },
}));
