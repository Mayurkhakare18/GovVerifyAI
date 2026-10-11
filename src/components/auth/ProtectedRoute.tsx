/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from '../../contexts/RouterContext';
import { AuthModal } from './AuthModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentPath, setIntendedDestination, navigate } = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setIntendedDestination(currentPath);
      setShowAuthModal(true);
    }
  }, [isLoading, isAuthenticated, currentPath, setIntendedDestination]);

  // Loading state during initial session restoration
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-[#EAF1FF] border border-[#2457C5]/20 flex items-center justify-center text-[#2457C5]">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#182230] tracking-tight">
              Verifying Citizen Session
            </h2>
            <p className="mt-1 text-xs text-[#667085]">
              Restoring cryptographic credentials and row-level authorization...
            </p>
          </div>
          <div className="w-24 h-1 bg-[#E4E7EC] rounded-full overflow-hidden">
            <div className="h-full bg-[#2457C5] rounded-full animate-indeterminate" />
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated fallback gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-4 text-[#182230]">
        <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EAF1FF] border border-[#2457C5]/20 flex items-center justify-center text-[#2457C5] shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-[#182230]">
              Authenticated Workspace Access
            </h2>
            <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto">
              This area contains protected verification records and sovereign evidence. Please sign in to access your citizen workspace.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="w-full py-2.5 px-4 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Continue</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto py-2.5 px-4 bg-white border border-[#E4E7EC] hover:bg-[#F2F4F7] text-[#344054] text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Portal</span>
            </button>
          </div>
        </div>

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            initialTab="signin"
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
};
