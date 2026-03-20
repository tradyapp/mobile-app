import dataService from '@/services/DataService';
import { strategyNodeTypesService, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import {
  strategiesService,
  type StrategyNodeMap,
  type StrategyNodeVersionRecord,
  type StrategyTrackedSymbol,
} from '@/services/StrategiesService';
import { type StrategySymbolCatalogItem } from '@/modules/tabs/orion/NodeSettingsDrawer';

export async function loadNodeTypesAction(): Promise<StrategyNodeTypeRecord[]> {
  return strategyNodeTypesService.listActiveNodeTypes();
}

export async function loadStrategySymbolsAction(strategyId: string): Promise<StrategyTrackedSymbol[]> {
  const [rows, catalog] = await Promise.all([
    strategiesService.getStrategySymbols(strategyId),
    dataService.loadSymbols(),
  ]);

  const iconByTicker = new Map<string, string | null>();
  for (const item of catalog) {
    const ticker = String(item.symbol ?? '').toUpperCase();
    if (!ticker) continue;
    iconByTicker.set(ticker, item.icon_url ?? item.photo ?? null);
  }

  return rows.map((item) => ({
    ...item,
    icon_url: item.icon_url ?? iconByTicker.get(item.ticker.toUpperCase()) ?? null,
  }));
}

export async function loadAvailableSymbolsAction(): Promise<StrategySymbolCatalogItem[]> {
  const rows = await dataService.loadSymbols();
  return rows.map((item) => ({
    ticker: String(item.symbol ?? '').toUpperCase(),
    name: item.name ?? String(item.symbol ?? '').toUpperCase(),
    icon_url: item.icon_url ?? (item.photo?.startsWith('blob:') ? null : (item.photo ?? null)),
    market: item.type === 'FOREX' || item.type === 'CRYPTO' ? item.type : 'STOCKS',
  })).filter((item) => item.ticker.length > 0);
}

export async function saveStrategySymbolsAction(strategyId: string, symbols: StrategyTrackedSymbol[]): Promise<void> {
  await strategiesService.saveStrategySymbols(strategyId, symbols);
}

export async function deleteStrategyAction(strategyId: string): Promise<void> {
  await strategiesService.deleteStrategy(strategyId);
}

export async function loadNodeVersionsAction(strategyId: string): Promise<StrategyNodeVersionRecord[]> {
  return strategiesService.listStrategyNodeVersions(strategyId);
}

export async function publishVersionAction(params: {
  strategyId: string;
  draftPayload: StrategyNodeMap;
  versionName?: string;
}): Promise<StrategyNodeVersionRecord> {
  const { strategyId, draftPayload, versionName } = params;
  await strategiesService.saveStrategyNodeMap(strategyId, draftPayload);
  return strategiesService.createStrategyNodeVersion(strategyId, versionName, true);
}

export async function editPreviewAsDraftAction(strategyId: string, draftPayload: StrategyNodeMap): Promise<void> {
  await strategiesService.saveStrategyNodeMap(strategyId, draftPayload);
}

export async function activatePreviewVersionAction(strategyId: string, versionId: string): Promise<void> {
  await strategiesService.activateStrategyNodeVersion(strategyId, versionId);
}
