import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ApiClient from '../../../shared/api/client';
import { MobileStorageAdapter } from '../../../shared/api/mobile-storage';
import { API_CONFIG } from '../../../shared/constants/config';
import { User } from '../../../shared/types';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiClient: ApiClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize API client
const storage = new MobileStorageAdapter();
const apiClient = new ApiClient({
  baseURL: API_CONFIG.BASE_URL,
  storage,
  onUnauthorized: () => {
    // Handle unauthorized - will be set up after context is created
  },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await apiClient.isAuthenticated();
      if (authenticated) {
        // Verify token is still valid
        const response = await apiClient.verifyToken();
        setUser(response.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      // Token invalid or expired
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    setUser(response.user);
    setIsAuthenticated(true);
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await apiClient.register(email, name, password);
    setUser(response.user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        register,
        logout,
        apiClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
