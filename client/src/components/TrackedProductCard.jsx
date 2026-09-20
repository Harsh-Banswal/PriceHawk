import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, AlertCircle, Clock, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProduct, triggerScrapeProduct } from '../api/client.js';
import StockBadge from './StockBadge.jsx';
import StatusDot from './StatusDot.jsx';
import PriceDelta from './PriceDelta.jsx';

export function TrackedProductCard({ product }) {
  const hasPrice = product.latestPrice !== null && product.latestPrice > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: () => triggerScrapeProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-details', product.id] });
      queryClient.invalidateQueries({ queryKey: ['product-history', product.id] });
      queryClient.invalidateQueries({ queryKey: ['product-logs', product.id] });
    },
  });

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      deleteMutation.mutate();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
    }
  };

  const handleScrapeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrapeMutation.mutate();
  };

  // Calculate discount percentage if both MRP and price exist
  const discountPercent =
    hasPrice && product.latestMrp && product.latestMrp > product.latestPrice
      ? Math.round(((product.latestMrp - product.latestPrice) / product.latestMrp) * 100)
      : null;

  return (
    <div className="bg-[#0b0b0d] border border-neutral-800 hover:border-neutral-500 transition-all duration-300 flex flex-col justify-between group relative shadow-2xl">
      {/* 1. TOP WIREFRAME WINDOW BAR (Matching the photo's browser/window header) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121215] border-b border-neutral-800/90">
        <div className="flex items-center gap-2.5">
          {/* 3 Window Dots */}
          <div className="flex items-center gap-1.5 select-none">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            <span className="w-2 h-2 rounded-full border border-neutral-500 bg-transparent"></span>
            <span className="w-2 h-2 rounded-full border border-neutral-500 bg-transparent"></span>
          </div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
            SKU // {product.storeProductId}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id={`scrape-product-${product.id}`}
            onClick={handleScrapeClick}
            disabled={scrapeMutation.isPending}
            title="Scrape live price now via Playwright"
            className="p-1 px-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/80 hover:border-neutral-500 transition-all text-[11px] font-mono flex items-center gap-1"
          >
            {scrapeMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin text-white" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span className="hidden sm:inline text-[10px] uppercase font-bold">
              {scrapeMutation.isPending ? 'Scraping' : 'Scrape'}
            </span>
          </button>

          <button
            id={`delete-product-${product.id}`}
            onClick={handleDeleteClick}
            disabled={deleteMutation.isPending}
            title={confirmDelete ? 'Click again to confirm untracking' : 'Remove from monitoring'}
            className={`p-1 px-2 transition-all text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border
              ${confirmDelete
                ? 'bg-white text-black border-white animate-pulse'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-rose-400 border-neutral-700/80 hover:border-rose-500'
              }`}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            {confirmDelete && <span>Confirm?</span>}
          </button>
        </div>
      </div>

      {/* 2. CARD BODY */}
      <div className="p-5 space-y-4">
        {/* Status Indicators Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusDot outcome={product.lastOutcome} showLabel inverted />
            {product.reconciled && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-300 px-2 py-0.5 border border-neutral-800"
                title="Live price synced with storefront"
              >
                <ShieldCheck className="w-3 h-3 text-neutral-400" /> Synced
              </span>
            )}
          </div>
          <StockBadge
            status={product.stockText || product.rawStockStatus || product.stockStatus}
            units={product.stockUnits}
            inverted
          />
        </div>

        {/* Product Title */}
        <Link to={`/products/${product.id}`} className="block">
          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-neutral-200 line-clamp-2 leading-snug tracking-tight font-sans transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Pricing Zone */}
        <div className="pt-4 border-t border-neutral-800/80">
          {hasPrice ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-sans">
                    ₹{Number(product.latestPrice).toLocaleString('en-IN')}
                  </span>
                  {product.latestMrp && product.latestMrp > product.latestPrice && (
                    <span className="text-xs font-mono text-neutral-500 line-through">
                      ₹{Number(product.latestMrp).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {discountPercent !== null && (
                  <span className="text-[10px] font-mono font-semibold text-neutral-400 uppercase tracking-wide block mt-0.5">
                    {discountPercent}% Off Catalog MRP
                  </span>
                )}
              </div>

              <PriceDelta delta={product.priceDelta24h} label="24h" inverted />
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                <AlertCircle className="w-4 h-4 text-white shrink-0" />
                <span className="font-mono text-[11px] uppercase">Awaiting Verification</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400 uppercase">
                {product.lastOutcome || 'Pending'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARD FOOTER BAR */}
      <div className="px-5 py-3 border-t border-neutral-800/90 bg-[#08080a] flex items-center justify-between text-xs font-mono text-neutral-400">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          <span>Cadence: {product.scrapeIntervalMinutes}m</span>
        </div>

        <Link
          to={`/products/${product.id}`}
          className="inline-flex items-center gap-1.5 font-bold text-white hover:text-neutral-300 group-hover:translate-x-1 transition-all uppercase tracking-wider text-[11px]"
        >
          <span>Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>
    </div>
  );
}

export default TrackedProductCard;
