/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import Layout from './components/Layout'
import Index from './pages/Index'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import OnboardingsList from './pages/OnboardingsList'
import NovoOnboarding from './pages/NovoOnboarding'
import DetalheOnboarding from './pages/DetalheOnboarding'
import ModelosTarefas from './pages/ModelosTarefas'
import Avaliacoes from './pages/Avaliacoes'
import Colaboradores from './pages/Colaboradores'
import Usuarios from './pages/Usuarios'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Rotas Protegidas (Exigem Login) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/onboardings" element={<OnboardingsList />} />
            <Route path="/onboardings/nova" element={<NovoOnboarding />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/colaboradores/:id" element={<DetalheOnboarding />} />
            <Route path="/modelos" element={<ModelosTarefas />} />
            <Route path="/avaliacoes" element={<Avaliacoes />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
