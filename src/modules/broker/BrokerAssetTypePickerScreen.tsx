"use client";
import { useEffect, useState } from "react";
import { Block, List, ListItem } from "konsta/react";
import { HiChartBar, HiCube, HiSwitchHorizontal } from "react-icons/hi";
import type { IconType } from "react-icons";
import AppNavbar from "@/components/AppNavbar";
import { useBrokerStore } from "@/stores/brokerStore";
import type { BrokerAssetType } from "@/services/BrokerService";

interface Props {
  accountId: string;
}

interface AssetOption {
  key: BrokerAssetType;
  label: string;
  Icon: IconType;
}

const OPTIONS: AssetOption[] = [
  { key: "STOCKS", label: "Stocks", Icon: HiChartBar },
  { key: "CRYPTO", label: "Crypto", Icon: HiCube },
  { key: "FOREX", label: "Forex", Icon: HiSwitchHorizontal },
];

export default function BrokerAssetTypePickerScreen({ accountId }: Props) {
  const navigate = useBrokerStore((s) => s.navigate);
  const goBack = useBrokerStore((s) => s.goBack);
  const [enterLoading, setEnterLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnterLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, []);

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

  return (
    <>
      <AppNavbar title="New Order" left={navbarLeft} />

      <Block>
        {enterLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-white/8 bg-transparent px-4 py-3 shadow-lg shadow-black/10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-white/6 animate-pulse shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-24 rounded-full bg-white/8 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <List strongIos insetIos>
            {OPTIONS.map(({ key, label, Icon }) => (
              <ListItem
                key={key}
                link
                title={label}
                media={
                  <span className="flex h-9 w-9 items-center justify-center text-zinc-300">
                    <Icon className="h-5 w-5" />
                  </span>
                }
                onClick={() => navigate({ kind: "trade", accountId, assetType: key })}
              />
            ))}
          </List>
        )}
      </Block>
    </>
  );
}
