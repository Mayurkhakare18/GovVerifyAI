import React, { useEffect, useRef } from 'react';
import { X, AlertCircle, Info, CheckCircle2, ArrowRight } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: 'info' | 'phase-notice' | 'warning' | 'success';
  badgeText?: string;
  children: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  isOpen,
  onClose,
  title,
  type = 'info',
  badgeText = 'Phase 1 Notice',
  children,
  primaryActionLabel = 'Understood',
  onPrimaryAction,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-brand-green" aria-hidden="true" />;
      case 'phase-notice':
        return <Info className="w-5 h-5 text-brand-blue" aria-hidden="true" />;
      default:
        return <Info className="w-5 h-5 text-brand-slate" aria-hidden="true" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-brand-border overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between p-5.5 border-b border-brand-border bg-brand-bg-subtle/80">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-white border border-brand-border shadow-2xs">
              {getIcon()}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                {badgeText}
              </div>
              <h2 id="modal-title" className="text-base sm:text-lg font-bold text-brand-navy leading-tight">
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-brand-slate hover:text-brand-navy hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-brand-blue"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-sm text-brand-slate leading-relaxed max-h-[70vh] overflow-y-auto space-y-3.5">
          {children}
        </div>

        <div className="flex items-center justify-end gap-3 p-4.5 border-t border-brand-border bg-brand-bg-subtle/50">
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy-light rounded-xl shadow-xs transition-colors focus-visible:outline-brand-blue"
          >
            <span>{primaryActionLabel}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
