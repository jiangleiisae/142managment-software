import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthUser } from '../api/auth'
import { tokenStorage } from '../api/client'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (tenantName: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_STORAGE_KEY = 'tcms.user'

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (tokenStorage.get() ? readStoredUser() : null))

  const persistSession = (accessToken: string, authUser: AuthUser) => {
    tokenStorage.set(accessToken)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  const login = async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login({ email, password })
    persistSession(accessToken, user)
  }

  const register = async (tenantName: string, email: string, password: string) => {
    const { accessToken, user } = await authApi.register({ tenantName, email, password })
    persistSession(accessToken, user)
  }

  const logout = () => {
    tokenStorage.clear()
    localStorage.removeItem(USER_STORAGE_KEY)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, register, logout }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
