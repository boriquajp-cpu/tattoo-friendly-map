import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';

import './lib/i18n';

import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import MapPage from './pages/MapPage';
import FacilityListPage from './pages/FacilityListPage';
import FacilityDetailPage from './pages/FacilityDetailPage';
import ReportFormPage from './pages/ReportFormPage';
import LoginPage from './pages/LoginPage';
import MyReportsPage from './pages/MyReportsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Loading...</div>}>
          <Layout>
            <Routes>
              <Route path="/" element={<MapPage />} />
              <Route path="/list" element={<FacilityListPage />} />
              <Route path="/facility/:id" element={<FacilityDetailPage />} />
              <Route path="/facility/:id/report" element={<ReportFormPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/my-reports" element={<MyReportsPage />} />
              <Route
                path="*"
                element={
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <h2>404 - ページが見つかりません</h2>
                    <a href="/" style={{ color: '#6366f1' }}>トップに戻る</a>
                  </div>
                }
              />
            </Routes>
          </Layout>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
