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
import GradeCursos from './pages/GradeCursos'
import Avaliacoes from './pages/Avaliacoes'
import Colaboradores from './pages/Colaboradores'
import Usuarios from './pages/Usuarios'
import Logs from './pages/Logs'
import Manual from './pages/Manual'
import ColaboradorPublico from './pages/ColaboradorPublico'
import CandidatoProvaPublica from './pages/CandidatoProvaPublica'
import { ColaboradorAvaliacaoPublica } from './pages/ColaboradorAvaliacaoPublica'
import { ColaboradorDocumentoPublico } from './pages/ColaboradorDocumentoPublico'
import { ColaboradorFeedbackPublico } from './pages/ColaboradorFeedbackPublico'
import PreSelecionados from './pages/PreSelecionados'
import LimpezaAmbiente from './pages/LimpezaAmbiente'
import ImpressaoQuestionario from './pages/ImpressaoQuestionario'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <Routes>
          {/* Rota Protegida de Impressão Dedicada (sem layout/sidebar para print A4 perfeito) */}
          <Route
            path="/avaliacoes/impressao/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'rh', 'gestao']}>
                <ImpressaoQuestionario />
              </ProtectedRoute>
            }
          />

          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/colaborador/:token" element={<ColaboradorPublico />} />
          <Route path="/candidato/prova/:token" element={<CandidatoProvaPublica />} />
          <Route path="/avaliacao/:token" element={<ColaboradorAvaliacaoPublica />} />
          <Route path="/documento-complementar/:token" element={<ColaboradorDocumentoPublico />} />
          <Route path="/feedback-avaliacao/:token" element={<ColaboradorFeedbackPublico />} />

          {/* Rotas Protegidas (Exigem Login) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/pre-selecionados" element={<PreSelecionados />} />
            <Route path="/onboardings" element={<OnboardingsList />} />
            <Route path="/onboardings/nova" element={<NovoOnboarding />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/colaboradores/:id" element={<DetalheOnboarding />} />
            <Route path="/manual" element={<Manual />} />
            <Route
              path="/modelos"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rh', 'gestao']}>
                  <ModelosTarefas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/grade-cursos"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rh', 'gestao']}>
                  <GradeCursos />
                </ProtectedRoute>
              }
            />
            <Route path="/avaliacoes" element={<Avaliacoes />} />
            <Route
              path="/logs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Logs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rh']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/limpeza"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <LimpezaAmbiente />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
