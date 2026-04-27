"use client";
import { Block } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import { useBrokerStore } from "@/stores/brokerStore";
import type { BrokerAssetType } from "@/services/BrokerService";

interface Props {
  accountId: string;
}

interface AssetOption {
  key: BrokerAssetType | "OPTIONS";
  label: string;
  subtitle: string;
  icon: string;
  accent: string;
  ring: string;
  enabled: boolean;
}

const OPTIONS: AssetOption[] = [
  {
    key: "STOCKS",
    label: "Stocks",
    subtitle: "Trade real-world equities and ETFs.",
    icon: "📈",
    accent: "from-emerald-500/15 to-emerald-400/5",
    ring: "border-emerald-400/25 hover:border-emerald-400/50",
    enabled: true,
  },
  {
    key: "OPTIONS",
    label: "Options",
    subtitle: "Calls and puts. Coming soon.",
    icon: "🎯",
    accent: "from-amber-500/10 to-amber-400/5",
    ring: "border-amber-400/15",
    enabled: false,
  },
  {
    key: "CRYPTO",
    label: "Crypto",
    subtitle: "BTC, ETH and other digital assets.",
    icon: "🪙",
    accent: "from-violet-500/15 to-violet-400/5",
    ring: "border-violet-400/25 hover:border-violet-400/50",
    enabled: true,
  },
  {
    key: "FOREX",
    label: "Forex",
    subtitle: "Major and minor currency pairs.",
    icon: "💱",
    accent: "from-sky-500/15 to-sky-400/5",
    ring: "border-sky-400/25 hover:border-sky-400/50",
    enabled: true,
  },
];

export default function BrokerAssetTypePickerScreen({ accountId }: Props) {
  const navigate = useBrokerStore((s) => s.navigate);
  const goBack = useBrokerStore((s) => s.goBack);

  const navbarLeft = (
    <button
      onClick={goBack}
      className="ml-2 flex items-center gap-1 text-sm text-emerald-400"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  const handlePick = (option: AssetOption) => {
    if (!option.enabled) return;
    navigate({
      kind: "trade",
      accountId,
      assetType: option.key as BrokerAssetType,
    });
  };

  return (
    <>
      <AppNavbar title="New Order" left={navbarLeft} />

      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Choose Asset</div>
          <div className="mt-1 text-base text-zinc-300">
            Pick the kind of instrument you want to trade.
          </div>
        </div>
      </Block>

      <Block>
        <div className="grid grid-cols-1 gap-3">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => handlePick(option)}
              disabled={!option.enabled}
              className={`group relative overflow-hidden rounded-[24px] border bg-gradient-to-br ${option.accent} ${option.ring} p-5 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/80 text-2xl">
                  {option.icon}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold text-white">{option.label}</span>
                    {option.enabled ? (
                      <span className="text-zinc-500 transition group-hover:text-zinc-300">›</span>
                    ) : (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                        Soon
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-sm text-zinc-400">{option.subtitle}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}
