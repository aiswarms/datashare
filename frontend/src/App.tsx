import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const MySpacePage = lazy(() => import('./pages/MySpacePage'))
const DownloadPage = lazy(() => import('./pages/DownloadPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/my-space" element={<MySpacePage />} />
          <Route path="/download/:token" element={<DownloadPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
