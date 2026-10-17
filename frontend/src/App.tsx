import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { UniversalLoadingScreen } from '@/components/ui/UniversalLoadingScreen'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DriveLayout } from '@/layouts/DriveLayout'
import { UploadProvider } from '@/context/UploadContext'
import { MascotProvider } from '@/components/mascot'
import { ThemeProvider } from '@/lib/theme'
import { NotificationProvider } from '@/context/NotificationContext'

const AllFilesPage = lazy(() => import('@/pages/AllFilesPage').then((m) => ({ default: m.AllFilesPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const GoogleAuthPage = lazy(() => import('@/pages/GoogleAuthPage').then((m) => ({ default: m.GoogleAuthPage })))
const GoogleConnectedPage = lazy(() => import('@/pages/GoogleConnectedPage').then((m) => ({ default: m.GoogleConnectedPage })))
const QuotaTrackerPage = lazy(() => import('@/pages/QuotaTrackerPage').then((m) => ({ default: m.QuotaTrackerPage })))
const RecentPage = lazy(() => import('@/pages/RecentPage').then((m) => ({ default: m.RecentPage })))
const SettingsLayout = lazy(() => import('@/layouts/SettingsLayout').then((m) => ({ default: m.SettingsLayout })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const MembersPage = lazy(() => import('@/pages/MembersPage').then((m) => ({ default: m.MembersPage })))
const AccountsPage = lazy(() => import('@/pages/AccountsPage').then((m) => ({ default: m.AccountsPage })))
const ApiKeysPage = lazy(() => import('@/pages/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage })))
const NotificationPreferencesPage = lazy(() => import('@/pages/NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })))
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })))
const SharedPage = lazy(() => import('@/pages/SharedPage').then((m) => ({ default: m.SharedPage })))
const StarredPage = lazy(() => import('@/pages/StarredPage').then((m) => ({ default: m.StarredPage })))
const PublicFilePage = lazy(() => import('@/pages/PublicFilePage').then((m) => ({ default: m.PublicFilePage })))
const TermiusPage = lazy(() => import('@/pages/TermiusPage').then((m) => ({ default: m.TermiusPage })))
const TrashPage = lazy(() => import('@/pages/TrashPage').then((m) => ({ default: m.TrashPage })))
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage })))

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <MascotProvider>
          <UploadProvider>
            <Suspense fallback={<UniversalLoadingScreen fullscreen message="Better Drive" />}>
              <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="google-auth" element={<GoogleAuthPage />} />
                <Route path="google-connected" element={<GoogleConnectedPage />} />
                <Route path="public/files/:token" element={<PublicFilePage />} />
                <Route path="public/files/:token/embed" element={<PublicFilePage embed />} />
                <Route path="invitations/:token/accept" element={<AcceptInvitationPage />} />
                <Route path="invitations/:token" element={<AcceptInvitationPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<DriveLayout />}>
                    <Route index element={<Navigate to="/all-files" replace />} />
                    <Route path="all-files" element={<AllFilesPage />} />
                    <Route path="quota" element={<QuotaTrackerPage />} />
                    <Route path="shared" element={<SharedPage />} />
                    <Route path="recent" element={<RecentPage />} />
                    <Route path="starred" element={<StarredPage />} />
                    <Route path="archived" element={<Navigate to="/all-files" replace />} />
                    <Route path="trash" element={<TrashPage />} />
                    <Route path="activity" element={<ActivityLogPage />} />
                    <Route path="termius" element={<TermiusPage />} />
                    <Route path="sftp" element={<Navigate to="/termius" replace />} />
                    
                    {/* Rock-solid Settings Layout with fixed header & tab bar */}
                    <Route path="settings" element={<SettingsLayout />}>
                      <Route index element={<Navigate to="profile" replace />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="accounts" element={<AccountsPage />} />
                      <Route path="members" element={<MembersPage />} />
                      <Route path="notifications" element={<NotificationPreferencesPage />} />
                      <Route path="api-keys" element={<Navigate to="/api" replace />} />
                      <Route path="legacy" element={<SettingsPage />} />
                    </Route>

                    {/* Dedicated standalone API Keys section page */}
                    <Route path="api" element={<ApiKeysPage />} />
                    <Route path="api-keys" element={<Navigate to="/api" replace />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/all-files" replace />} />
              </Routes>
            </Suspense>
          </UploadProvider>
        </MascotProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
