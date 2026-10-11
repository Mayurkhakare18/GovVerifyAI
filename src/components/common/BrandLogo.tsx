import React, { useState } from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
  lightText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 36,
  showText = true,
  showTagline = true,
  lightText = false,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Official GovVerify G-Emblem Logo */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden transition-transform duration-200 group-hover:scale-105"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {!imageError ? (
          <img
            src="/govverify-icon.png"
            alt="GovVerify AI Emblem"
            className="w-full h-full object-contain drop-shadow-xs"
            width={size}
            height={size}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="w-full h-full rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#10264A' }}
          >
            <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1">
              <path
                d="M18 3.5L7 7.8V17.2C7 24.3 11.7 30.8 18 32.5C24.3 30.8 29 24.3 29 17.2V7.8L18 3.5Z"
                fill="#175CD3"
              />
              <path
                d="M13 18.5L16.5 22L23 15"
                stroke="#FFFFFF"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span
            className={`text-lg sm:text-xl font-extrabold tracking-tight leading-none ${
              lightText ? 'text-white' : 'text-brand-navy'
            }`}
          >
            GovVerify{' '}
            <span className={lightText ? 'text-blue-400 font-black' : 'text-brand-blue font-black'}>
              AI
            </span>
          </span>
          {showTagline && (
            <span
              className={`text-[11px] font-semibold tracking-wide mt-0.5 ${
                lightText ? 'text-slate-400' : 'text-brand-slate'
              }`}
            >
              Verify. Know. Trust.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

