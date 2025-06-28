import { apiClient } from './apiClient'
import type { 
  User, 
  LoginRequest, 
  RegisterRequest,
  AuthResponse
} from '@gemini-cli-webui/shared'

// Define response types locally since they might not exist in shared
type LoginResponse = AuthResponse
type RegisterResponse = AuthResponse

export const authApi = {
  // User registration
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', userData)
  },

  // User login
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials)
  },

  // User logout
  async logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout')
  },

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/refresh-token', { refreshToken })
  },

  // Get current user info
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me')
  },

  // Update user profile
  async updateProfile(updates: Partial<User>): Promise<User> {
    return apiClient.patch<User>('/auth/me', updates)
  },

  // Change password
  async changePassword(data: {
    currentPassword: string
    newPassword: string
  }): Promise<void> {
    return apiClient.post<void>('/auth/change-password', data)
  },

  // Get active sessions
  async getSessions(): Promise<Array<{
    id: string
    deviceInfo: string
    ipAddress: string
    lastActivity: Date
    current: boolean
  }>> {
    return apiClient.get('/auth/sessions')
  },

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    return apiClient.delete(`/auth/sessions/${sessionId}`)
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    return apiClient.post<void>('/auth/forgot-password', { email })
  },

  // Reset password with token
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return apiClient.post<void>('/auth/reset-password', { token, newPassword })
  },

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    return apiClient.post<void>('/auth/verify-email', { token })
  },

  // Resend verification email
  async resendVerification(): Promise<void> {
    return apiClient.post<void>('/auth/resend-verification')
  },
}