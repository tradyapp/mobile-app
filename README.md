# Trady Mobile App

Mobile app built with Vite + React + Tailwind + Konsta + Capacitor.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Run dev server:

```bash
npm run dev
```

4. Build web bundle:

```bash
npm run build
```

## Capacitor

```bash
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

## Backend Integration

- Auth: Supabase Auth (`src/stores/authStore.ts`, `src/services/AuthService.ts`)
- Symbols: Supabase table `symbols` (`src/services/DataService.ts`)
- Candles: historic tables `hd_{market}_{timeframe}` + realtime tables `symbol_minute_candles` and `market_status` (`src/services/StockDataService.ts`)
- User profile: Supabase table `user_profiles` (`src/services/UserService.ts`)

## Notes

- UI was migrated from `references/trady/mobile-app`.
- Drawing and chart template persistence is currently localStorage-based to keep full UI behavior while backend tables for these preferences are defined.
