# Budgetly 🍦

A minimal monthly budget tracker. Not for tracking all your money, just the few budgets you want to
keep an eye on (groceries, eating out, fun...) and whether you're over or under this month.

- Multiple budgets, each with its own **name, emoji, currency and monthly amount**
- A **radial** shows what's left, shifting from your "good" color to your "bad" color as you spend
- **Resets every month** automatically; history is kept (last month's total is shown)
- Soft vanilla theme (warm dark in dark mode), no pure white or black
- React + Vite, with a tiny dependency-free Node server that keeps data in one JSON file

## Install on umbrelOS

App Store → ••• → **Community App Stores** → add:

```
https://github.com/zeroject/budgetly
```

Then install **Budgetly** from "Zeroject's Apps". The image is built by GitHub Actions
(`ghcr.io/zeroject/budgetly`, amd64 + arm64). Data lives in the app's data folder (`budgets.json`).

## Run locally

```
npm install
npm run build && npm start     # http://localhost:3000, data in ./data
```

Hot reload: `npm run dev:api` in one terminal and `npm run dev` in another.

## License

MIT
