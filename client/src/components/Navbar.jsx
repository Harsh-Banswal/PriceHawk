import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearchClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/') {
      const inputEl = document.getElementById('catalog-search-input') || document.getElementById('search-section');
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          inputEl.focus?.();
        }, 300);
      }
    } else {
      navigate('/#search');
    }
  };

  const handleLiveMonitorClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById('monitored-grid');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo matching the wireframe */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded bg-black flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-sm">
            PT
          </div>
          <div>
            <span className="text-sm font-black tracking-widest text-neutral-900 uppercase">
              PriceTracker
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-neutral-600 uppercase tracking-widest border-l border-neutral-300 pl-2">
              Autonomous Price Monitor
            </span>
          </div>
        </Link>

        {/* Navigation links & action buttons */}
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-5 text-xs font-semibold tracking-wider uppercase text-neutral-600">
            <Link
              to="/"
              className={`hover:text-black transition-colors ${
                location.pathname === '/' ? 'text-black font-bold border-b-2 border-black pb-0.5' : ''
              }`}
            >
              Dashboard
            </Link>
            <button
              type="button"
              id="nav-search-btn"
              onClick={handleSearchClick}
              className="hover:text-black transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer font-semibold"
            >
              Search
            </button>
          </nav>

          <div className="flex items-center">
            <Link
              to="/#monitored-grid"
              onClick={handleLiveMonitorClick}
              className="text-xs font-mono font-bold px-3.5 py-1.5 rounded bg-black text-white hover:bg-neutral-800 transition-colors uppercase tracking-wider shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Monitor</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
