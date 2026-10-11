import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 36,
  showText = true,
  showTagline = true,
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Custom GovVerify Shield & Checkmark Emblem */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-xs border border-brand-softblue-border"
        style={{ width: size, height: size, backgroundColor: '#10264A' }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1"
        >
          {/* Subtle civic shield outline */}
          <path
            d="M18 3.5L7 7.8V17.2C7 24.3 11.7 30.8 18 32.5C24.3 30.8 29 24.3 29 17.2V7.8L18 3.5Z"
            fill="#175CD3"
            stroke="#EFF6FF"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />
          {/* Core shield facet */}
          <path
            d="M18 5L9 8.6V16.8C9 22.8 12.9 28.3 18 29.8C23.1 28.3 27 22.8 27 16.8V8.6L18 5Z"
            fill="#10264A"
          />
          {/* Civic architectural balance bar */}
          <line
            x1="12"
            y1="13"
            x2="24"
            y2="13"
            stroke="#175CD3"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Verified Checkmark */}
          <path
            d="M13 18.5L16.5 22L23 15"
            stroke="#159B62"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13 18.5L16.5 22L23 15"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-brand-navy leading-none">
            GovVerify <span className="text-brand-blue font-black">AI</span>
          </span>
          {showTagline && (
            <span className="text-[11px] font-semibold text-brand-slate tracking-wide mt-0.5">
              Verify. Know. Trust.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
