/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Global Error Boundary Component
 * Prevents unhandled React rendering crashes from showing a blank white screen.
 * Displays citizen-friendly recovery options with reload and navigation actions.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GovVerify AI] Uncaught runtime rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4 antialiased text-[#182230]">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-[#E4E7EC] p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-[#2457C5] uppercase bg-[#EAF1FF] px-2.5 py-1 rounded-md border border-[#D1E9FF]">
                Application Recovery
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#182230] tracking-tight">
                Temporary Loading Issue
              </h1>
              <p className="text-sm text-[#475467] leading-relaxed">
                GovVerify AI encountered an unexpected issue while preparing the interface. Your session data is intact.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2457C5] hover:bg-[#1E48A6] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#E4E7EC] text-xs font-bold transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>

            {/* Expandable Technical Details */}
            {this.state.error && (
              <div className="pt-4 border-t border-[#F2F4F7] text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#182230] transition-colors"
                >
                  <span>Technical details</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
