import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Play,
  Loader2,
  ArrowRight,
  Cpu,
  Activity,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { getTrackedProducts, triggerScrapeAll, getScraperStatus } from '../api/client.js';
import SearchBar from '../components/SearchBar.jsx';
import TrackedProductCard from '../components/TrackedProductCard.jsx';
import BauhausGraphic from '../components/BauhausGraphic.jsx';

export function Dashboard() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#monitored-grid') {
        setTimeout(() => {
          document.getElementById('monitored-grid')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else if (window.location.hash === '#search' || window.location.hash === '#search-section') {
        setTimeout(() => {
          const el = document.getElementById('catalog-search-input') || document.getElementById('search-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus?.();
          }
        }, 100);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 1. Live polling every 5s — captures autonomous background price updates automatically
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['tracked-products'],
    queryFn: getTrackedProducts,
    refetchInterval: 5000,
  });

  // 2. Background scheduler telemetry
  const { data: statusData } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: getScraperStatus,
    refetchInterval: 8000,
  });
  const scheduler = statusData?.scheduler;

  const scrapeAllMutation = useMutation({
    mutationFn: () => triggerScrapeAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
      queryClient.invalidateQueries({ queryKey: ['scraper-status'] });
    },
  });

  const handleProductTracked = () => {
    queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
  };

  const healthyCount = products.filter((p) => p.lastOutcome === 'success').length;
  const issuesCount = products.filter((p) => p.lastOutcome && p.lastOutcome.startsWith('failed')).length;

  return (
    <div className="space-y-16 pb-20">
      {/* 1. HERO SECTION (White background with 2 columns, matching photo) */}
      <section className="pt-8 sm:pt-12 border-b border-neutral-200 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading + Copy + Search input */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-100 border border-neutral-300 text-[11px] font-mono uppercase tracking-widest text-neutral-800">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                Autonomous Price Architecture
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-neutral-900 tracking-tight leading-[1.08] font-sans">
                Real-Time E-Commerce Price & Stock Radar
              </h1>

              <div className="space-y-1.5 text-xs text-neutral-600 font-mono">
                <p className="font-bold text-neutral-800 uppercase tracking-wide">SYSTEM ACTIVE // 24/7 AUTONOMOUS MONITORING</p>
                <p>Anti-bot bypass · WASM PoW challenge solver · DOM stabilization</p>
                <p>Track price drops, stock availability, and historical telemetry in real time.</p>
              </div>

              <div id="search-section" className="pt-2 max-w-xl">
                <SearchBar onProductTracked={handleProductTracked} />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => scrapeAllMutation.mutate()}
                  disabled={scrapeAllMutation.isPending}
                  className="px-6 py-3 bg-black hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  {scrapeAllMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Executing Live Run...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Live Scrape</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <a
                  href="#monitored-grid"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-800 hover:text-black underline underline-offset-4"
                >
                  View Monitored ({products.length})
                </a>
              </div>
            </div>

            {/* Right Column: Bauhaus Geometric Illustration Mockup Window */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-lg bg-white border border-neutral-900 p-2 shadow-sm">
                <BauhausGraphic variant="light" className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUSTED BY / TICKER STRIP (Row of circular badges matching photo) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-4">
        <p className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-6">
          Supported Catalog Brands Monitored Live
        </p>
        <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
          {['COBALT', 'DOMUS', 'AMPERAGE', 'LARKSPUR', 'VISTA', 'NORDKRAFT'].map((brand, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white text-[10px] font-mono font-bold group-hover:bg-neutral-800 transition-colors">
                {brand.slice(0, 2)}
              </div>
              <span className="text-[10px] font-mono text-neutral-500 group-hover:text-black uppercase font-bold tracking-wider">
                {brand}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. INVERTED DARK SECTION (Matching dark block in photo) */}
      <section className="bg-neutral-900 text-white py-16 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content in Dark Block */}
            <div className="lg:col-span-6 space-y-5">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Automated Anti-Bot & Proof-of-Work Bypassing
              </h2>
              <div className="space-y-1 text-xs font-mono text-neutral-400">
                <p className="text-white font-bold">ENGINE: HEADLESS PLAYWRIGHT CHROMIUM</p>
                <p>WASM cryptographic challenge solver active</p>
                <p>Dynamic session tokens retrieved & renewed automatically</p>
              </div>
              <p className="text-xs text-neutral-400 font-mono leading-relaxed pt-2">
                Modern storefronts protect live dynamic pricing behind WebAssembly Proof-of-Work (PoW) computational puzzles and interactive hover gates. Our scraping pipeline executes realistic user interactions, solves token challenges in isolated browser contexts, and captures stable retail prices without triggering rate limits.
              </p>

              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
                  <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span>Autonomous 15m to 24h background scheduling</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
                  <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span>Consecutive-read DOM stabilization ensures accurate final price capture</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
                  <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span>Zero synthetic data carry-forward on unverified failures</span>
                </div>
              </div>
            </div>

            {/* Right Inverted Graphic Card */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-lg bg-black border border-neutral-700 p-2 shadow-2xl">
                <BauhausGraphic variant="dark" className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ALTERNATING WIREFRAME FEATURE SECTION (Matching second split block in photo) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Geometric Graphic */}
          <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center">
            <div className="w-full max-w-lg bg-neutral-50 border border-neutral-300 p-2">
              <BauhausGraphic variant="light" className="w-full" />
            </div>
          </div>

          {/* Right: Text Block */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
            <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
              Historical Price Telemetry & Drop Detection
            </h2>
            <div className="space-y-1 text-xs font-mono text-neutral-600">
              <p className="text-black font-bold">STORAGE: SUPABASE POSTGRESQL & PRICE DELTAS</p>
              <p>Continuous 24h & 7d change tracking</p>
              <p>Full diagnostic audit logs with duration, attempts, and error traces</p>
            </div>
            <p className="text-xs text-neutral-600 font-mono leading-relaxed">
              Every tracked product retains historical records in Supabase PostgreSQL. View price deltas, 24-hour fluctuations, stock availability, and exportable audit logs for all retail SKU movements over time.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-800">
                Live Postgres Change Capture & In-Memory SWR Caching
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SPLIT WIREFRAME BANNER ("The best way to wireframe a website" in photo) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 border border-neutral-900 bg-white">
          {/* Left Black Banner */}
          <div className="lg:col-span-7 bg-black text-white p-8 sm:p-12 flex flex-col justify-between space-y-8">
            <div className="flex items-center gap-6">
              {/* Wireframe mini Bauhaus icon */}
              <div className="w-16 h-16 border border-neutral-700 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 60 60" className="w-12 h-12 stroke-white fill-none">
                  <rect x="25" y="5" width="22" height="22" strokeWidth="1.5" />
                  <circle cx="20" cy="35" r="12" strokeWidth="1.5" />
                  <polygon points="25,48 50,48 37.5,26" strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block mb-1">
                  ARCHITECTURE
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  End-to-End Autonomous Tracking Pipeline
                </h3>
              </div>
            </div>

            <p className="text-xs font-mono text-neutral-400 leading-relaxed max-w-lg">
              Automated cron schedules trigger headless Chromium workers, bypass client-side anti-bot challenges, stabilize live prices, and persist audit logs in Supabase.
            </p>
          </div>

          {/* Right Split Wireframe Cards (2 columns) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-900">
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-4 bg-white">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 tracking-tight mb-2">
                  Live Stock & Price Fluctuation Monitoring
                </h4>
                <p className="text-[11px] font-mono text-neutral-500 leading-relaxed">
                  Real-time stock view and 24h/7d price delta calculations.
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-4 bg-white">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 tracking-tight mb-2">
                  Diagnostic Logs & Telemetry Audit Trail
                </h4>
                <p className="text-[11px] font-mono text-neutral-500 leading-relaxed">
                  Historical telemetry charts and per-scrape audit logs allow instant identification of true flash sales versus inflated MRP discounts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>      {/* 6. MONITORED PRODUCTS TRACKING GRID (Operational Core - Full-Width Inverted Dark Section) */}
      <section id="monitored-grid" className="bg-[#111113] text-white py-16 sm:py-20 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Section Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                  LIVE ENGINE // CONTINUOUS CHROMIUM MONITORING
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase font-sans">
                  Monitored Products
                </h2>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white text-black shadow-xs">
                  {products.length} TRACKED
                </span>
                {scheduler?.isRunning && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-neutral-700 text-[10px] font-mono font-bold uppercase text-neutral-300 bg-neutral-900/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-Scheduler Active
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
              {healthyCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-neutral-300 uppercase font-bold text-[11px] bg-neutral-900 border border-neutral-800 px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  {healthyCount} Verified
                </span>
              )}
              {issuesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-neutral-400 uppercase font-bold text-[11px] bg-neutral-900 border border-neutral-800 px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full border border-neutral-400" />
                  {issuesCount} Scrape Failures (Visible)
                </span>
              )}

              <button
                onClick={() => {
                  queryClient.fetchQuery({
                    queryKey: ['tracked-products'],
                    queryFn: () => getTrackedProducts(true),
                  });
                }}
                disabled={isFetching}
                title="Query database cache for newest price records"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono font-bold uppercase transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-white' : ''}`} />
                Refresh DB
              </button>

              <button
                onClick={() => scrapeAllMutation.mutate()}
                disabled={scrapeAllMutation.isPending}
                title="Launch Playwright Chromium worker across all monitored products"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md"
              >
                {scrapeAllMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scraping All...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    Scrape All Live
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Scrape Notification Banner */}
          {scrapeAllMutation.isPending && (
            <div className="bg-neutral-900 border border-neutral-700 p-4 flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                <div>
                  <p className="font-bold text-white uppercase">
                    Full Live Scrape Cycle In Progress
                  </p>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Playwright workers are navigating product URLs, solving PoW challenges, and syncing live prices.
                  </p>
                </div>
              </div>
              <span className="font-bold uppercase tracking-wider text-[10px] bg-white text-black px-2.5 py-1">
                TIMEOUT: 5M
              </span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-[#0b0b0d] border border-neutral-800 p-5 h-64 animate-pulse space-y-4"
                >
                  <div className="h-4 bg-neutral-800 rounded w-1/3 mb-4"></div>
                  <div className="h-6 bg-neutral-800 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-neutral-800 rounded w-1/2 mb-6"></div>
                  <div className="h-8 bg-neutral-800 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="bg-[#0b0b0d] border border-neutral-700 p-8 text-center max-w-lg mx-auto font-mono">
              <AlertCircle className="w-8 h-8 text-white mx-auto mb-3" />
              <h3 className="text-sm font-bold uppercase text-white">
                Unable to load monitored products
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {error?.message || 'Check server connection at http://localhost:3000'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-white text-black text-xs font-mono font-bold uppercase tracking-wider"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && products.length === 0 && (
            <div className="bg-[#0b0b0d] border border-dashed border-neutral-800 p-12 text-center space-y-4">
              <div className="w-12 h-12 border border-neutral-700 bg-neutral-900 flex items-center justify-center mx-auto text-white font-mono font-bold text-sm">
                0
              </div>
              <div>
                <h3 className="text-base font-bold uppercase text-white font-mono">
                  No monitored products yet
                </h3>
                <p className="text-xs text-neutral-400 font-mono max-w-sm mx-auto mt-1">
                  Type into the search bar above to track catalog products and begin autonomous price telemetry.
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && !isError && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <TrackedProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>


      {/* 7. PRE-FOOTER CTA SECTION */}
      <section className="bg-neutral-100 border-y border-neutral-300 py-16 text-center">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Start Monitoring Retail Prices Now
          </h3>
          <p className="text-xs font-mono text-neutral-600 max-w-md mx-auto leading-relaxed">
            Track catalog price drops, inventory fluctuations, and historical telemetry with automated headless Chromium workers.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-8 py-3 bg-black hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              Track a Product
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
