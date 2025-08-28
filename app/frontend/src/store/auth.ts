/**
 * Authentication store using Zustand
 * Manages user authentication state and token persistence
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  verified: boolean
  createdAt: string
  updatedAt: string
}

interface AuthState {
  // State
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  setLoading: (loading: boolean) => void
  login: (user: User, token: string, refreshToken: string) => void
  logout: () => void
  clearAuth: () => void
  updateUser: (updates: Partial<User>) => void
}

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Setters
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setLoading: (isLoading) => set({ isLoading }),

      // Login action
      login: (user, token, refreshToken) => {
        set({
          user,
          token,
          refreshToken,
          isLoading: false,
        })
      },

      // Logout action
      logout: () => {
        set(initialState)
        // Clear any cached data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('dizipush-query-cache')
        }
      },

      // Clear auth (for invalid tokens)
      clearAuth: () => {
        set(initialState)
      },

      // Update user information
      updateUser: (updates) => {
        const currentUser = get().user
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              ...updates,
            },
          })
        }
      },
    }),
    {
      name: 'dizipush-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

// Selectors for easier component usage
export const useAuth = () => {
  const store = useAuthStore()
  return {
    user: store.user,
    token: store.token,
    isAuthenticated: !!(store.user && store.token),
    isLoading: store.isLoading,
    login: store.login,
    logout: store.logout,
    updateUser: store.updateUser,
  }
}

export const useAuthToken = () => {
  return useAuthStore((state) => state.token)
}

export const useAuthUser = () => {
  return useAuthStore((state) => state.user)
}

export default useAuthStore