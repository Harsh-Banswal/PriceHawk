import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, Check, ArrowRight } from 'lucide-react';
import { searchCatalog, trackProduct } from '../api/client.js';

export function SearchBar({ onProductTracked }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [trackedSet, setTrackedSet] = useState(new Set());

  // 400ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query catalog on debouncedTerm change
  useEffect(() => {
    if (!debouncedTerm) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    searchCatalog(debouncedTerm)
      .then((data) => {
        if (isMounted) {
          const uniqueItems = [];
          const seen = new Set();
          for (const item of data || []) {
            if (!seen.has(item.storeProductId)) {
              seen.add(item.storeProductId);
              uniqueItems.push(item);
            }
          }
          setResults(uniqueItems);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setResults([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedTerm]);

  const handleTrack = async (item) => {
    setTrackingId(item.storeProductId);
    try {
      await trackProduct({
        storeProductId: item.storeProductId,
        name: item.name,
        slug: item.slug,
        productUrl: item.productUrl,
      });

      setTrackedSet((prev) => new Set(prev).add(item.storeProductId));
      if (onProductTracked) {
        onProductTracked();
      }
    } catch (err) {
      console.error('Failed to track product:', err);
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Search className="w-4 h-4 text-black" />
          )}
        </div>
        <input
          id="catalog-search-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search catalog by product name or brand (e.g., Headphones, Watch)..."
          className="w-full pl-10 pr-28 py-3 bg-white border border-neutral-900 text-neutral-900 placeholder-neutral-400 text-xs font-mono tracking-tight focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
        />
        <div className="absolute right-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 border border-neutral-200 px-2 py-1 bg-neutral-50">
            AUTO-QUERY
          </span>
        </div>
      </div>

      {/* Results Dropdown / Grid */}
      {debouncedTerm && !isLoading && results.length === 0 && (
        <div className="mt-3 p-4 bg-white border border-neutral-900 shadow-md text-xs font-mono text-neutral-600 flex items-center justify-between">
          <span>No products found matching &ldquo;<strong className="text-black">{debouncedTerm}</strong>&rdquo;.</span>
          <span className="text-[10px] text-neutral-400 uppercase">Try SKU (e.g., 237) or Brand</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-3 p-4 bg-white border border-neutral-900 shadow-xl space-y-3 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 text-xs font-mono">
            <span className="font-bold text-neutral-900 uppercase">
              Found {results.length} Catalog Matches
            </span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
              Store API Feed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map((item) => {
              const isTracked = trackedSet.has(item.storeProductId);
              const isTracking = trackingId === item.storeProductId;

              return (
                <div
                  key={item.storeProductId}
                  className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <h4 className="text-xs font-bold text-neutral-900 truncate uppercase tracking-tight">
                      {item.name}
                    </h4>
                    <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">
                      {item.brand ? `${item.brand} • ` : ''}SKU: {item.storeProductId}
                    </p>
                  </div>

                  <button
                    onClick={() => handleTrack(item)}
                    disabled={isTracked || isTracking}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all shrink-0 ${
                      isTracked
                        ? 'bg-neutral-200 text-neutral-800 border border-neutral-400'
                        : 'bg-black hover:bg-neutral-800 text-white border border-black shadow-sm'
                    }`}
                  >
                    {isTracking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : isTracked ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tracked</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Track</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
