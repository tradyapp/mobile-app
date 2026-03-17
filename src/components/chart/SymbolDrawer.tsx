/* eslint-disable @next/next/no-img-element */
'use client'

import AppDrawer from "../uiux/AppDrawer";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Searchbar, Segmented, SegmentedButton } from "konsta/react";
import dataService from "@/services/DataService";
import { SymbolType } from "@/stores/chartStore";

interface SymbolDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSymbol: string;
  onSymbolSelect: (symbol: string, symbolType?: SymbolType, symbolName?: string) => void;
  initialSearchLetter?: string;
}

type Category = 'all' | 'stocks' | 'forex' | 'crypto';

interface Symbol {
  ticker: string;
  name: string;
  photo: string | null;
  category: Category;
}

export default function SymbolDrawer({
  isOpen,
  onOpenChange,
  selectedSymbol,
  onSymbolSelect,
  initialSearchLetter,
}: SymbolDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchbarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cargar símbolos al montar
  useEffect(() => {
    const loadSymbols = () => {
      try {
        setIsLoading(true);
        const data = dataService.getSymbols();

        // Mapear los datos del servicio a nuestro formato
        const mappedSymbols: Symbol[] = data.map(item => ({
          ticker: item.symbol,
          name: item.name || item.symbol,
          photo: item.photo,
          category: item.type === 'STOCK' ? 'stocks'
                  : item.type === 'FOREX' ? 'forex'
                  : item.type === 'CRYPTO' ? 'crypto'
                  : 'stocks' // default
        }));

        setSymbols(mappedSymbols);
      } catch (error) {
        console.error('Error loading symbols:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSymbols();
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Si hay una letra inicial, establecerla en el query
      if (initialSearchLetter) {
        setSearchQuery(initialSearchLetter);
      }
      // Esperar un poco para que el drawer termine de abrirse
      const timer = setTimeout(() => {
        searchbarRef.current?.querySelector('input')?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Limpiar el query cuando se cierra
      setSearchQuery('');
    }
  }, [isOpen, initialSearchLetter]);

  const filteredSymbols = symbols.filter((symbol) => {
    const matchesSearch =
      symbol.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      symbol.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || symbol.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categoryToSymbolType = (category: Category): SymbolType => {
    switch (category) {
      case 'crypto': return 'CRYPTO';
      case 'forex': return 'FOREX';
      default: return 'STOCK';
    }
  };

  const handleSelect = useCallback((ticker: string, category: Category, name: string) => {
    onSymbolSelect(ticker, categoryToSymbolType(category), name);
    onOpenChange(false);
    setSearchQuery('');
  }, [onSymbolSelect, onOpenChange]);

  // Reset highlight when search or category changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, selectedCategory]);

  // Keyboard navigation
  useEffect(() => {
    const input = searchbarRef.current?.querySelector('input');
    if (!input) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredSymbols.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        input.blur();
        setHighlightedIndex(prev => {
          const next = Math.min(prev + 1, filteredSymbols.length - 1);
          (listRef.current?.children[next] as HTMLElement)?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        input.blur();
        setHighlightedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          (listRef.current?.children[next] as HTMLElement)?.focus();
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredSymbols[highlightedIndex];
        if (item) handleSelect(item.ticker, item.category, item.name);
      }
    };

    const handleListKeyDown = (e: KeyboardEvent) => {
      if (filteredSymbols.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = Math.min(prev + 1, filteredSymbols.length - 1);
          (listRef.current?.children[next] as HTMLElement)?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (prev === 0) {
            input.focus();
            return 0;
          }
          const next = prev - 1;
          (listRef.current?.children[next] as HTMLElement)?.focus();
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredSymbols[highlightedIndex];
        if (item) handleSelect(item.ticker, item.category, item.name);
      }
    };

    const list = listRef.current;
    input.addEventListener('keydown', handleKeyDown);
    list?.addEventListener('keydown', handleListKeyDown);
    return () => {
      input.removeEventListener('keydown', handleKeyDown);
      list?.removeEventListener('keydown', handleListKeyDown);
    };
  }, [filteredSymbols, highlightedIndex, handleSelect]);

  // Scroll highlighted item into view
  useEffect(() => {
    const container = listRef.current;
    const item = container?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Select Symbol"
      height="full"
    >
      {/* Search Bar */}
      <div ref={searchbarRef} className="mb-3 -mx-4 px-4 [&_input]:rounded-xl!">
        <Searchbar
          placeholder="Search symbols..."
          value={searchQuery}
          onInput={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
        />
      </div>

      {/* Category Filter */}
      <div className="mb-3">
        <Segmented strong className="w-full [&_button]:py-1.5 [&_button]:text-[11px]">
          <SegmentedButton
            active={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </SegmentedButton>
          <SegmentedButton
            active={selectedCategory === 'stocks'}
            onClick={() => setSelectedCategory('stocks')}
          >
            NYSE
          </SegmentedButton>
          <SegmentedButton
            active={selectedCategory === 'forex'}
            onClick={() => setSelectedCategory('forex')}
          >
            Forex
          </SegmentedButton>
          <SegmentedButton
            active={selectedCategory === 'crypto'}
            onClick={() => setSelectedCategory('crypto')}
          >
            Crypto
          </SegmentedButton>
        </Segmented>
      </div>

      {/* Symbols List */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5">
        {isLoading ? (
          <div className="text-center text-zinc-500 py-8">
            Loading symbols...
          </div>
        ) : filteredSymbols.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            No symbols found
          </div>
        ) : (
          filteredSymbols.map((symbol, index) => (
            <button
              key={symbol.ticker}
              onClick={() => handleSelect(symbol.ticker, symbol.category, symbol.name)}
              className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-2.5 ${
                index === highlightedIndex
                  ? 'bg-zinc-600'
                  : selectedSymbol === symbol.ticker
                    ? 'bg-zinc-700'
                    : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {symbol.photo ? (
                <img
                  src={symbol.photo}
                  alt={symbol.ticker}
                  className="w-8 h-8 rounded-md object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-2xs bg-zinc-700 text-white">
                  {symbol.ticker.substring(0, 3)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium text-sm text-white">{symbol.ticker}</div>
                <div className="text-xs text-zinc-400">{symbol.name}</div>
              </div>
              {selectedSymbol === symbol.ticker && (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))
        )}
      </div>
    </AppDrawer>
  );
}
