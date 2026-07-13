import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';

// i18n の初期化（副作用として実行）
import './lib/i18n';

import Layout from './components/Layout/Layout';
import MapPage from './pages/MapPage';
import FacilityListPage from './pages/FacilityListPage';
import FacilityDetailPage from './pages/FacilityDetailPage';
import ReportFormPage from './pages/ReportFormPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Loading...</div>}>
        <Layout>
          <Routes>
            {/* メインマップ */}
            <Route path="/" element={<MapPage />} />

            {/* 施設一覧 */}
            <Route path="/list" element={<FacilityListPage />} />

            {/* 施設詳細 */}
            <Route path="/facility/:id" element={<FacilityDetailPage />} />

            {/* 報告投稿 */}
            <Route path="/facility/:id/report" element={<ReportFormPage />} />

            {/* ログイン */}
            <Route path="/login" element={<LoginPage />} />

            {/* 404 フォールバック */}
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
  );
}

export default App;
