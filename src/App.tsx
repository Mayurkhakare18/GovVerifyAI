/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { RouterProvider, useRouter } from './contexts/RouterContext';
import { LandingPage } from './components/landing/LandingPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardLayout } from './components/dashboard/DashboardLayout';

// Lazy-loaded Authenticated Dashboard Views
const DashboardOverview = React.lazy(() =>
  import('./components/dashboard/DashboardOverview').then((m) => ({
    default: m.DashboardOverview,
  }))
);

const VerificationWorkspace = React.lazy(() =>
  import('./components/dashboard/VerificationWorkspace').then((m) => ({
    default: m.VerificationWorkspace,
  }))
);

const VerificationHistory = React.lazy(() =>
  import('./components/dashboard/VerificationHistory').then((m) => ({
    default: m.VerificationHistory,
  }))
);

const VerificationResultDetail = React.lazy(() =>
  import('./components/dashboard/VerificationResultDetail').then((m) => ({
    default: m.VerificationResultDetail,
  }))
);

const SourcesAndEvidence = React.lazy(() =>
  import('./components/dashboard/SourcesAndEvidence').then((m) => ({
    default: m.SourcesAndEvidence,
  }))
);

const ProfileSettings = React.lazy(() =>
  import('./components/dashboard/ProfileSettings').then((m) => ({
    default: m.ProfileSettings,
  }))
);

const DashboardLoadingSkeleton = () => (
  <div className="space-y-6 max-w-7xl mx-auto py-4">
    <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
    <div className="h-36 bg-white border border-[#E4E7EC] rounded-2xl animate-pulse" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-28 bg-white border border-[#E4E7EC] rounded-2xl animate-pulse"
        />
      ))}
    </div>
    <div className="h-64 bg-white border border-[#E4E7EC] rounded-2xl animate-pulse" />
  </div>
);

function AppRouter() {
  const { currentPath } = useRouter();

  // ============================================================================
  // Authenticated Application Routes (/app, /app/*)
  // ============================================================================
  if (currentPath === '/app' || currentPath.startsWith('/app/')) {
    let dashboardContent = <DashboardOverview />;

    if (currentPath === '/app/verify') {
      dashboardContent = <VerificationWorkspace />;
    } else if (currentPath.startsWith('/app/history/')) {
      dashboardContent = <VerificationResultDetail />;
    } else if (currentPath === '/app/history') {
      dashboardContent = <VerificationHistory />;
    } else if (currentPath === '/app/sources') {
      dashboardContent = <SourcesAndEvidence />;
    } else if (currentPath === '/app/profile') {
      dashboardContent = <ProfileSettings />;
    }

    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Suspense fallback={<DashboardLoadingSkeleton />}>
            {dashboardContent}
          </Suspense>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // ============================================================================
  // Public Marketing & Sovereign Intake Landing Page (/)
  // ============================================================================
  return <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppRouter />
      </RouterProvider>
    </AuthProvider>
  );
}
