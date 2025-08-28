/**
 * DiziPush Main Application Component
 * Handles routing, authentication, and layout
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

// Layout components
import { AuthLayout } from '@/components/layouts/auth-layout'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'

// Auth pages
import { LoginPage } from '@/pages/auth/login'
import { RegisterPage } from '@/pages/auth/register'
import { ForgotPasswordPage } from '@/pages/auth/forgot-password'
import { ResetPasswordPage } from '@/pages/auth/reset-password'

// Dashboard pages
import { DashboardPage } from '@/pages/dashboard/dashboard'
import { ProjectsPage } from '@/pages/dashboard/projects'
import { ProjectDetailPage } from '@/pages/dashboard/project-detail'
import { DomainsPage } from '@/pages/dashboard/domains'
import { SubscribersPage } from '@/pages/dashboard/subscribers'
import { SegmentsPage } from '@/pages/dashboard/segments'
import { CampaignsPage } from '@/pages/dashboard/campaigns'
import { CampaignCreatePage } from '@/pages/dashboard/campaign-create'
import { CampaignDetailPage } from '@/pages/dashboard/campaign-detail'
import { AnalyticsPage } from '@/pages/dashboard/analytics'
import { SettingsPage } from '@/pages/dashboard/settings'
import { ApiKeysPage } from '@/pages/dashboard/api-keys'
import { WebhooksPage } from '@/pages/dashboard/webhooks'
import { BackupsPage } from '@/pages/dashboard/backups'
import { AuditLogsPage } from '@/pages/dashboard/audit-logs'
import { ProfilePage } from '@/pages/dashboard/profile'

// Public pages
import { LandingPage } from '@/pages/public/landing'
import { NotFoundPage } from '@/pages/public/not-found'

// API and hooks
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// Types
interface User {
  id: string
  email: string
  name: string | null
  role: string
  verified: boolean
}

function App() {
  const { token, setUser, setToken, clearAuth } = useAuthStore()

  // Check authentication status
  const { data: user, isLoading: isAuthLoading, error: authError } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await api.get('/auth/me')
      return response.data
    },
    enabled: !!token,
    retry: false,
    onSuccess: (userData) => {
      setUser(userData)
    },
    onError: () => {
      // Clear invalid token
      clearAuth()
    },
  })

  // Show loading spinner while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading DiziPush...</p>
        </div>
      </div>
    )
  }

  const isAuthenticated = !!token && !!user && !authError

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Auth routes */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route 
          path="login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
          } 
        />
        <Route 
          path="register" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
          } 
        />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Protected dashboard routes */}
      <Route
        path="/dashboard/*"
        element={
          isAuthenticated ? (
            <DashboardLayout user={user}>
              <Routes>
                <Route index element={<DashboardPage />} />
                
                {/* Project management */}
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="projects/:projectId/domains" element={<DomainsPage />} />
                <Route path="projects/:projectId/subscribers" element={<SubscribersPage />} />
                <Route path="projects/:projectId/segments" element={<SegmentsPage />} />
                
                {/* Campaign management */}
                <Route path="projects/:projectId/campaigns" element={<CampaignsPage />} />
                <Route path="projects/:projectId/campaigns/new" element={<CampaignCreatePage />} />
                <Route path="projects/:projectId/campaigns/:campaignId" element={<CampaignDetailPage />} />
                
                {/* Analytics */}
                <Route path="projects/:projectId/analytics" element={<AnalyticsPage />} />
                
                {/* Settings */}
                <Route path="projects/:projectId/settings" element={<SettingsPage />} />
                <Route path="projects/:projectId/api-keys" element={<ApiKeysPage />} />
                <Route path="projects/:projectId/webhooks" element={<WebhooksPage />} />
                <Route path="projects/:projectId/backups" element={<BackupsPage />} />
                <Route path="projects/:projectId/audit-logs" element={<AuditLogsPage />} />
                
                {/* User profile */}
                <Route path="profile" element={<ProfilePage />} />
                
                {/* Catch-all for dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />

      {/* Catch-all route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App