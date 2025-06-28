import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storage, CONSTANTS } from '@/lib/utils'
import { authApi } from '@/services/authApi'
import type { User, LoginRequest, RegisterRequest } from '@gemini-cli-webui/shared'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<boolean>
  register: (userData: RegisterRequest) => Promise<boolean>
  logout: () => Promise<void>
  refreshAuth: () => Promise<boolean>
  initializeAuth: () => void
  clearError: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.login(credentials)
          
          set({
            user: response.user,
            token: response.accessToken,
            refreshToken: response.refreshToken,
            isLoading: false,
            error: null
          })
          
          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : '登录失败'
          set({
            isLoading: false,
            error: message,
            user: null,
            token: null,
            refreshToken: null
          })
          return false
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.register(userData)
          
          set({
            user: response.user,
            token: response.accessToken,
            refreshToken: response.refreshToken,
            isLoading: false,
            error: null
          })
          
          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : '注册失败'
          set({
            isLoading: false,
            error: message,
            user: null,
            token: null,
            refreshToken: null
          })
          return false
        }
      },

      logout: async () => {
        const { token } = get()
        
        try {
          if (token) {
            await authApi.logout()
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            refreshToken: null,
            error: null
          })
          
          // Clear all related storage
          storage.remove(CONSTANTS.STORAGE_KEYS.AUTH_TOKEN)
          storage.remove(CONSTANTS.STORAGE_KEYS.USER_PREFERENCES)
        }
      },

      refreshAuth: async () => {
        const { refreshToken } = get()
        
        if (!refreshToken) {
          return false
        }

        try {
          const response = await authApi.refreshToken(refreshToken)
          
          set({
            token: response.accessToken,
            refreshToken: response.refreshToken || refreshToken,
            user: response.user
          })
          
          return true
        } catch (error) {
          console.error('Token refresh failed:', error)
          
          // Clear invalid tokens
          set({
            user: null,
            token: null,
            refreshToken: null,
            error: '登录已过期，请重新登录'
          })
          
          return false
        }
      },

      initializeAuth: () => {
        const token = storage.get<string>(CONSTANTS.STORAGE_KEYS.AUTH_TOKEN)
        
        if (token) {
          // Verify token validity by fetching user info
          authApi.getCurrentUser()
            .then((user) => {
              set({ user, token })
            })
            .catch(() => {
              // Token is invalid, clear storage
              storage.remove(CONSTANTS.STORAGE_KEYS.AUTH_TOKEN)
              set({ token: null, user: null })
            })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setUser: (user) => {
        set({ user })
      }
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken
      }),
      onRehydrateStorage: () => (state) => {
        // Initialize auth after rehydration
        if (state?.token) {
          state.initializeAuth()
        }
      }
    }
  )
)