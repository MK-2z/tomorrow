import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

// This is a temporary placeholder component from spark-framework


import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import LoginPage from './pages/login/LoginPage';
import QualityEvalPage from './pages/quality-eval/QualityEvalPage';
import QualityEvalListPage from './pages/quality-eval-list/QualityEvalListPage';
import ReviewListPage from './pages/review-list/ReviewListPage';
import ReviewDetailPage from './pages/review-detail/ReviewDetailPage';
import UserManagementPage from './pages/user-management/UserManagementPage';
import FillTimeSettingsPage from './pages/fill-time-settings/FillTimeSettingsPage';
import OperationLogsPage from './pages/operation-logs/OperationLogsPage';
import RequireRole from './components/RequireRole';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const HomeRedirect: React.FC = () => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
    return <Navigate to="/review" replace />;
  }
  return <Navigate to="/eval" replace />;
};

const RoutesComponent = () => {
  return (
    <AuthProvider>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomeRedirect />} />
        <Route
          path="eval"
          element={
            <RequireRole roles={['student', 'admin', 'super_admin']}>
              <QualityEvalPage />
            </RequireRole>
          }
        />
        <Route
          path="records"
          element={
            <RequireRole roles={['student', 'admin', 'super_admin']}>
              <QualityEvalListPage />
            </RequireRole>
          }
        />
        <Route
          path="review"
          element={
            <RequireRole roles={['admin', 'super_admin']}>
              <ReviewListPage />
            </RequireRole>
          }
        />
        <Route
          path="review/detail"
          element={
            <RequireRole roles={['admin', 'super_admin']}>
              <ReviewDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="logs"
          element={
            <RequireRole roles={['super_admin']}>
              <OperationLogsPage />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={['super_admin']}>
              <UserManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="settings/fill-time"
          element={
            <RequireRole roles={['super_admin']}>
              <FillTimeSettingsPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
};

export default RoutesComponent;
