import { Routes, Route, Navigate } from 'react-router-dom'

import AthleteGate from './pages/athlete/AthleteGate'
import AthleteLayout from './pages/athlete/AthleteLayout'
import RejectedPage from './pages/RejectedPage'
import LoginPage from './pages/LoginPage'
import PendingPage from './pages/PendingPage'
import SignupPage from './pages/SignupPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminGate from './pages/admin/AdminGate'
import RankingPublic from './pages/RankingPublic'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

export default function App() {
  return (
    <Routes>
      <Route path='/login' element={<LoginPage />} />
      <Route path='/signup' element={<SignupPage />} />
      <Route path='/esqueci-senha' element={<ForgotPasswordPage />} />
      <Route path='/redefinir-senha' element={<ResetPasswordPage />} />

      <Route
        path='/athlete/*'
        element={
          <AthleteGate>
            <AthleteLayout />
          </AthleteGate>
        }
      />

      <Route
        path='/admin/*'
        element={
          <AdminGate>
            <AdminLayout />
          </AdminGate>
        }
      />

      <Route path='/app/*' element={<Navigate to='/athlete' replace />} />

      <Route
        path='/ranking'
        element={
          <AthleteGate>
            <RankingPublic />
          </AthleteGate>
        }
      />

      <Route path='/pending' element={<PendingPage />} />
      <Route path='/rejected' element={<RejectedPage />} />

      <Route path='/' element={<Navigate to='/login' replace />} />
      <Route path='*' element={<Navigate to='/login' replace />} />
    </Routes>
  )
}