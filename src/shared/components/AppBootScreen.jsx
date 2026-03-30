import React from 'react';

const shellBackground = {
  background:
    'radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 20rem), linear-gradient(180deg, #e2e8f0 0%, #f8fafc 18rem)',
};

const AppBootScreen = ({
  message = 'Loading your page securely.',
  minHeightClass = 'min-h-screen',
}) => {
  return (
    <div
      className={`${minHeightClass} flex flex-col items-center justify-between gap-[18px] px-5 py-8 text-slate-900`}
      style={shellBackground}
      role="status"
      aria-live="polite"
    >
      <div />
      <div className="flex flex-col items-center gap-[18px]">
        <img
          className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
          src="/itm-logo.png"
          alt=""
          width="56"
          height="56"
        />
        <div className="text-base font-bold tracking-[0.01em]">Indian Trade Mart</div>
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-300/40 border-t-[#003D82]" />
        <div className="max-w-[420px] text-center text-[15px] leading-6 text-slate-600">
          {message}
        </div>
      </div>
      <div />
    </div>
  );
};

export default AppBootScreen;
