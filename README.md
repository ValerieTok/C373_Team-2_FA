# PopMart dApp setup

## Local setup (per teammate)
1. `npm install`
2. Start Ganache (local chain)
3. `truffle migrate --reset`
4. `npm run sync-artifacts`
5. `npm start`

If you change networks, re-run steps 3-5 so the frontend picks up the new contract address.
