# MySATS

Track your bitcoin in Philippine pesos and work out what an investment could be worth. A sibling app to MyDEL: same stack (Expo SDK 54, React Native Web, TypeScript, AsyncStorage) and installable as a PWA.

## Features

- **Dashboard**: live ₱ price (CoinGecko), holdings value, cost, profit/loss, average buy price, break-even price, 30D/90D/1Y chart.
- **Log**: buys, sells, receives and sends. Sats are worked out from ₱ ÷ price, and you can't sell more than you held on that date.
- **History**: grouped by month and filterable. Tap a row to edit or delete it (with undo).
- **Calculator**: "If I invest ₱X at price A, what is it worth at price B?", a scenario table (−20% to 2×), and "What price do I need to earn ₱Y?". Fees are charged when buying and again when selling.
- **Settings**: theme, sats/BTC display, optional USD, default fee, your sources, JSON backup and import, and delete all data.

Data stays on the device. There's no account, and the app never asks for keys or seed phrases.

## How the numbers work

- Bitcoin is stored as integer **satoshis**. Pesos are converted to integer **centavos** before any arithmetic, so there's no floating-point drift.
- Buying rounds sats **down**, as an exchange does. That's why ₱50,000 at ₱6,000,000 is 833,333 sats, worth ₱62,499.98 (not ₱62,500.00) at ₱7,500,000.
- Profit uses the **average-cost** method. A sell removes its share of cost basis; the rest of the proceeds is realized profit.

All of this lives in `src/logic/` (pure TypeScript, no UI) and is covered by `tests/`.

## Commands

```bash
npm install
npm run web          # dev server in the browser
npm test             # unit tests (Node's built-in test runner)
npm run typecheck
npm run build:web    # static PWA in dist/, paths fixed for GitHub Pages at /MySATS/
```

## Price data

[CoinGecko public API](https://www.coingecko.com/en/api): `/simple/price` (PHP + USD, refreshed every 60s while open) and `/coins/bitcoin/market_chart` (cached for an hour). The last price is cached, so the app still works offline and shows how old the price is.
