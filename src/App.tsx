import AthleteGate from './pages/athlete/AthleteGate';
import AthleteLayout from './pages/athlete/AthleteLayout';
import RejectedPage from './pages/RejectedPage';
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import PendingPage from './pages/PendingPage'
import SignupPage from './pages/SignupPage'
import AppLayout from './pages/app/AppLayout'
import AdminLayout from './pages/admin/AdminLayout'
import RankingPublic from './pages/RankingPublic'

export default function App() {
  return (
    <Routes>
      <Route path='/athlete/*' element={<AthleteGate><AthleteLayout /></AthleteGate>} />
      <Route path='/login' element={<LoginPage />} />
      <Route path='/admin/*' element={<AdminLayout />} />
      <Route path='/app/*' element={<Navigate to='/athlete' replace />} />
      <Route path='/signup' element={<SignupPage />} />
      <Route path='/ranking' element={<AthleteGate><RankingPublic /></AthleteGate>} />
      <Route path='/pending' element={<PendingPage />} />
      <Route path='/rejected' element={<RejectedPage />} />
      <Route path='/' element={<Navigate to='/admin' replace />} />
      <Route path='*' element={<Navigate to='/admin' replace />} />
    </Routes>
  )
}




