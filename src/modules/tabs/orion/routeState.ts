import { type MarketplaceTab, type MyStrategiesScreen } from '@/modules/tabs/orion/shared';

export interface OrionRouteState {
  view: 'notifications' | 'marketplace';
  marketplaceTab: MarketplaceTab;
  myStrategiesScreen: MyStrategiesScreen;
  selectedStrategyId: string | null;
}

export function parseOrionRoute(pathname: string): OrionRouteState {
  const normalized = pathname.replace(/\/+$/, '');

  if (normalized === '/orion' || normalized === '') {
    return {
      view: 'notifications',
      marketplaceTab: 'explore',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace') {
    return {
      view: 'marketplace',
      marketplaceTab: 'explore',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace/my-strategies') {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace/my-strategies/create') {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'create',
      selectedStrategyId: null,
    };
  }

  const backtestingMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/nodes\/backtesting$/);
  if (backtestingMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'nodes',
      selectedStrategyId: decodeURIComponent(backtestingMatch[1]),
    };
  }

  const nodesMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/nodes$/);
  if (nodesMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'nodes',
      selectedStrategyId: decodeURIComponent(nodesMatch[1]),
    };
  }

  const symbolsMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/symbols$/);
  if (symbolsMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'symbols',
      selectedStrategyId: decodeURIComponent(symbolsMatch[1]),
    };
  }

  const webhookMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/webhook$/);
  if (webhookMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'webhook',
      selectedStrategyId: decodeURIComponent(webhookMatch[1]),
    };
  }

  const detailMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)$/);
  if (detailMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'detail',
      selectedStrategyId: decodeURIComponent(detailMatch[1]),
    };
  }

  return {
    view: 'notifications',
    marketplaceTab: 'explore',
    myStrategiesScreen: 'list',
    selectedStrategyId: null,
  };
}
