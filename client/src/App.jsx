import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProductDetail from './pages/ProductDetail.jsx';

export function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 selection:bg-black selection:text-white font-sans antialiased">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Wireframe Multi-Column Footer matching reference photo */}
      <footer className="border-t border-neutral-300 bg-white pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-12">
            {/* Left Brand & CTA Column */}
            <div className="lg:col-span-6 space-y-4 pr-6">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-black flex items-center justify-center text-white text-[9px] font-mono font-bold">
                  PT
                </span>
                <span className="text-sm font-black tracking-widest uppercase font-sans">
                  PRICE TRACKER
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Ready to get started?
                </p>
                <p className="text-xs font-mono text-neutral-600 max-w-sm leading-relaxed">
                  Headless Playwright Chromium price and inventory monitoring architecture. Full history retention with zero false alerts.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                >
                  Start Live Tracking
                </button>
              </div>
            </div>

            {/* Right 4 Columns matching wireframe columns in photo */}
            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-6 font-mono text-xs">
              <div className="space-y-3">
                <p className="font-bold uppercase tracking-wider text-black text-[11px]">Product</p>
                <ul className="space-y-2 text-neutral-500 text-[11px]">
                  <li><Link to="/" className="hover:text-black">Dashboard</Link></li>
                  <li><a href="#monitored-grid" className="hover:text-black">Catalog</a></li>
                  <li><a href="#monitored-grid" className="hover:text-black">Telemetry</a></li>
                  <li><a href="#monitored-grid" className="hover:text-black">Alerts</a></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="font-bold uppercase tracking-wider text-black text-[11px]">Features</p>
                <ul className="space-y-2 text-neutral-500 text-[11px]">
                  <li><span className="hover:text-black cursor-default">PoW Solver</span></li>
                  <li><span className="hover:text-black cursor-default">DOM Parser</span></li>
                  <li><span className="hover:text-black cursor-default">Audit Logs</span></li>
                  <li><span className="hover:text-black cursor-default">Live Sync</span></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="font-bold uppercase tracking-wider text-black text-[11px]">Resources</p>
                <ul className="space-y-2 text-neutral-500 text-[11px]">
                  <li><span className="hover:text-black cursor-default">Docs</span></li>
                  <li><span className="hover:text-black cursor-default">API Reference</span></li>
                  <li><span className="hover:text-black cursor-default">Status Feed</span></li>
                  <li><span className="hover:text-black cursor-default">Changelog</span></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="font-bold uppercase tracking-wider text-black text-[11px]">Company</p>
                <ul className="space-y-2 text-neutral-500 text-[11px]">
                  <li><span className="hover:text-black cursor-default">About</span></li>
                  <li><span className="hover:text-black cursor-default">Architecture</span></li>
                  <li><span className="hover:text-black cursor-default">Contact</span></li>
                  <li><span className="hover:text-black cursor-default">Github</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Copyright and Legal Bar */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-neutral-500 gap-4">
            <p>(C) 2026 PriceTracker Pro • Built with Node.js, Playwright & Supabase</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-black cursor-pointer">Privacy Policy</span>
              <span className="hover:text-black cursor-pointer">Terms of Service</span>
              <span className="hover:text-black cursor-pointer">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
