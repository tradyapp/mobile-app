"use client";
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
      </Block>
    </>
  );
}
