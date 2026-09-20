import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Cpu,
  Star,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
} from 'lucide-react';
import {
  getProductDetails,
  getProductHistory,
  getProductLogs,
  deleteProduct,
  triggerScrapeProduct,
} from '../api/client.js';
import StockBadge from '../components/StockBadge.jsx';
import StatusDot from '../components/StatusDot.jsx';
import PriceChart from '../components/PriceChart.jsx';
import StatsRow from '../components/StatsRow.jsx';
import ScrapeLogsTable from '../components/ScrapeLogsTable.jsx';
import IntervalControl from '../components/IntervalControl.jsx';

const SPEC_LABEL_MAP = {
  warranty: 'Warranty',
  inTheBox: 'In The Box',
  countryOfOrigin: 'Country of Origin',
  returns: 'Returns Policy',
  support: 'Support Channel',
  weightGrams: 'Weight',
  material: 'Material',
  colour: 'Colour',
  modelYear: 'Model Year',
};

function formatSpecKey(key) {
  if (SPEC_LABEL_MAP[key]) return SPEC_LABEL_MAP[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toUpperCase();
}

function formatSpecValue(key, val) {
  if (key === 'weightGrams' && typeof val === 'number') {
    return `${val.toLocaleString()} g`;
  }
  return String(val);
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('all');
  const [reviewIndex, setReviewIndex] = useState(0);

  // Query 1: Product details & specs/reviews (live polling every 5s)
  const {
    data: detailData,
    isLoading: isDetailLoading,
    isError: isDetailError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['product-details', id],
    queryFn: () => getProductDetails(id),
    refetchInterval: 5000,
  });

  // Query 2: Price history series (live polling every 5s)
  const {
    data: history = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['product-history', id, range],
    queryFn: () => getProductHistory(id, range),
    refetchInterval: 5000,
  });

  // Query 3: Scrape execution logs
  const {
    data: logs = [],
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['product-logs', id],
    queryFn: () => getProductLogs(id, 50),
    refetchInterval: 8000,
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
      navigate('/');
    },
  });

  // Manual live scrape mutation
  const scrapeMutation = useMutation({
    mutationFn: () => triggerScrapeProduct(id),
    onSuccess: () => {
      refetchDetails();
      refetchHistory();
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
    },
  });

  if (isDetailLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-black mx-auto mb-4" />
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Loading product details and price telemetry...
        </p>
      </div>
    );
  }

  if (isDetailError || !detailData || !detailData.product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 font-mono">
        <div className="bg-white border border-black p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-black mx-auto mb-3" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            Product not found
          </h2>
          <p className="text-xs text-neutral-600 mt-1">
            The product could not be located or has been deleted from monitoring.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs uppercase tracking-wider font-bold hover:bg-neutral-800"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { product, specs = {}, review, reviews = [], description } = detailData;
  const activeReview = reviews && reviews.length > 0 ? reviews[reviewIndex % reviews.length] : review;
  const latestPrice = history.length > 0 ? history[history.length - 1].price : null;
  const latestLog = logs.length > 0 ? logs[0] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-neutral-700 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Monitored Products
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchDetails();
              refetchHistory();
              refetchLogs();
            }}
            title="Re-fetch stored history from database"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-mono font-bold uppercase border border-neutral-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>

          <button
            onClick={() => scrapeMutation.mutate()}
            disabled={scrapeMutation.isPending}
            title="Launch Chromium to scrape live price and update history"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all"
          >
            {scrapeMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scraping Price...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Scrape Price Now
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (window.confirm('Stop tracking this product and delete all historical price data?')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-black text-xs font-mono font-bold uppercase border border-neutral-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Untrack
          </button>
        </div>
      </div>

      {/* Main Product Header Card */}
      <div className="bg-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot outcome={latestLog?.outcome} showLabel inverted />
              {latestLog?.price_reconciled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-200 px-2 py-0.5 border border-neutral-700">
                  <ShieldCheck className="w-3 h-3 text-neutral-300" /> Synced
                </span>
              )}
              <StockBadge status={history[history.length - 1]?.stock_status} inverted />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-sans">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 text-xs font-mono text-neutral-400 flex-wrap">
              <span>SKU: <strong className="text-white">{product.store_product_id}</strong></span>
              {product.brand && (
                <>
                  <span>•</span>
                  <span>Brand: <strong className="text-white">{product.brand}</strong></span>
                </>
              )}
              {product.category && (
                <>
                  <span>•</span>
                  <span>Category: <strong className="text-white">{product.category}</strong></span>
                </>
              )}
              <span>•</span>
              <a
                href={product.product_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-white hover:text-neutral-300 font-bold uppercase underline hover:no-underline"
              >
                Visit Store Page <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="bg-neutral-900 px-6 py-4 border border-neutral-800">
            <span className="text-[10px] text-neutral-400 font-mono uppercase font-bold tracking-widest block">
              Latest Verified Price
            </span>
            <span className="text-3xl font-black text-white tracking-tight font-sans">
              {latestPrice ? `₹${Number(latestPrice).toLocaleString('en-IN')}` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <StatsRow history={history} latestPrice={latestPrice} />

      {/* Price Over Time Recharts Chart with Range Toggle */}
      <PriceChart
        history={history}
        range={range}
        onRangeChange={(newRange) => setRange(newRange)}
      />

      {/* Interval Control Card */}
      <IntervalControl
        productId={product.id}
        currentInterval={product.scrape_interval_minutes}
        onIntervalUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['product-details', id] });
        }}
      />

      {/* About This Item (if description is available) */}
      {(description || product.description) && (
        <div className="bg-white border border-neutral-300 p-6 space-y-2 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
            About This Item
          </h3>
          <p className="text-sm font-sans text-neutral-800 leading-relaxed">
            {description || product.description}
          </p>
        </div>
      )}

      {/* Specifications and Customer Review */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs Table */}
        <div className="lg:col-span-2 bg-white border border-neutral-300 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-tight">
              <Cpu className="w-5 h-5 text-black" />
              Product Specifications
            </h3>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500">
              {Object.keys(specs).length} Attributes
            </span>
          </div>
          <p className="text-xs font-mono text-neutral-500">
            Authentic metadata retrieved live from store catalog feed.
          </p>

          {Object.keys(specs).length > 0 ? (
            <div className="divide-y divide-neutral-200 text-xs font-mono">
              {Object.entries(specs).map(([specKey, specVal]) => (
                <div key={specKey} className="py-2.5 flex justify-between gap-4">
                  <span className="font-bold text-neutral-600 uppercase">
                    {formatSpecKey(specKey)}
                  </span>
                  <span className="text-neutral-900 text-right font-medium">
                    {formatSpecValue(specKey, specVal)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-neutral-400 py-4">
              No technical specifications published for this item.
            </p>
          )}
        </div>

        {/* Verified Customer Review */}
        <div className="bg-white border border-neutral-300 p-6 flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-tight">
                <Star className="w-5 h-5 text-black" />
                Verified Store Review
              </h3>
              {reviews.length > 1 && (
                <span className="text-[10px] font-mono text-neutral-500 font-bold">
                  {(reviewIndex % reviews.length) + 1} / {reviews.length}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-neutral-500 mt-1">
              Top customer feedback from product page metadata.
            </p>

            {activeReview ? (
              <div className="mt-4 p-4 bg-neutral-50 border border-neutral-300 space-y-3 font-mono">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-black">
                    {[...Array(Math.min(5, Math.max(1, activeReview.rating || 5)))].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-black text-black" />
                    ))}
                  </div>
                  {activeReview.verifiedPurchase && (
                    <span className="text-[9px] font-mono font-bold uppercase bg-black text-white px-1.5 py-0.5">
                      Verified Purchase
                    </span>
                  )}
                </div>

                {activeReview.title && (
                  <h4 className="text-sm font-bold text-neutral-900 font-sans">
                    {activeReview.title}
                  </h4>
                )}

                <p className="text-xs text-neutral-800 italic leading-relaxed font-sans">
                  "{activeReview.comment || activeReview.body}"
                </p>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                  <span className="uppercase font-bold">
                    {activeReview.author} • {activeReview.date}
                  </span>
                  {activeReview.helpfulVotes > 0 && (
                    <span className="flex items-center gap-1 text-neutral-600">
                      <ThumbsUp className="w-3 h-3" /> {activeReview.helpfulVotes} helpful
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 py-8 text-center text-xs font-mono text-neutral-400 uppercase tracking-wider">
                No customer reviews available yet.
              </div>
            )}
          </div>

          {reviews.length > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setReviewIndex((prev) => (prev - 1 + reviews.length) % reviews.length)}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase border border-neutral-300 hover:bg-neutral-100 flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setReviewIndex((prev) => (prev + 1) % reviews.length)}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase border border-neutral-300 hover:bg-neutral-100 flex items-center gap-1 transition-colors"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrape Execution Logs Table */}
      <ScrapeLogsTable logs={logs} />
    </div>
  );
}

export default ProductDetail;
