import React from 'react';
import { Link } from 'react-router-dom';
const Logo = ({
  className = "h-12",
  showTagline = true,
  variant = "dark"
}) => {
  // variant: 'dark' (for light backgrounds) | 'light' (for dark backgrounds)

  return <Link to="/" className={`flex items-center gap-3 group ${className}`}>
      <div className="relative flex-shrink-0">
        <img src="https://horizons-cdn.hostinger.com/f872dc8f-3c19-4e7d-8677-e9f5922486ba/logo-zU4Gc.png" alt="IndianTradeMART Logo" className="h-12 w-12 object-contain" src="https://eimager.com/images/itm.png" />
      </div>
      <div className="flex flex-col">
        <h1 className={`text-xl md:text-2xl font-bold tracking-tight leading-none ${variant === 'light' ? 'text-white' : 'text-[#8B6F47]'}`}>
          INDIAN TRADE <span className={variant === 'light' ? 'text-green-400' : 'text-[#059669]'}>MART</span>
        </h1>
        {showTagline && <span className={`text-[10px] md:text-xs uppercase tracking-widest font-medium ${variant === 'light' ? 'text-gray-300' : 'text-gray-500'}`}>
            Connect & Grow
          </span>}
      </div>
    </Link>;
};
export default Logo;