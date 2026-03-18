'use client'

import AppDrawer from "../uiux/AppDrawer";

interface IntervalDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInterval: string;
  onIntervalSelect: (interval: string) => void;
}

const intervals = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1H', label: '1 Hour' },
  { value: '1D', label: '1 Day' },
  { value: '1W', label: '1 Week' },
  { value: '1M', label: '1 Month' },
];

export default function IntervalDrawer({
  isOpen,
  onOpenChange,
  selectedInterval,
  onIntervalSelect,
}: IntervalDrawerProps) {
  const handleSelect = (interval: string) => {
    onIntervalSelect(interval);
    onOpenChange(false);
  };

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Select Interval"
      height="auto"
      description="Choose a time interval for the chart."
    >
      <div className="flex-1 overflow-y-auto space-y-2 pb-6">
        {intervals.map((interval) => (
          <button
            key={interval.value}
            onClick={() => handleSelect(interval.value)}
            className={`w-full px-4 py-4 rounded-lg text-left transition-colors ${
              selectedInterval === interval.value
                ? 'bg-zinc-700 text-white font-medium'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">{interval.label}</span>
              {selectedInterval === interval.value && (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
    </AppDrawer>
  );
}
