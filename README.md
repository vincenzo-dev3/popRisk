# 🎈 Balloon Game - Base Sub Accounts Demo

An interactive blockchain game demonstrating Base Account SDK Sub Accounts integration with seamless, gasless gaming on Base Sepolia.

## Features

- **Automatic Sub Account Creation**: Sub account is created automatically when users connect their wallet
- **Gasless Gaming Experience**: Play multiple rounds without repeated transaction approvals
- **2-Hour Sessions**: Session-based permissions for uninterrupted gameplay
- **Risk/Reward Gameplay**: Pump balloons to earn exponential points, but risk them popping!
- **On-Chain Leaderboard**: All high scores stored permanently on the blockchain
- **Modern UI**: Beautiful, animated interface with real-time game state

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Base Account (create one at [account.base.app](https://account.base.app))
- USDC on Base Sepolia testnet

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Game Rules

1. **Entry Fee**: Pay 0.001 ETH to start a new game
2. **5 Rounds**: Complete 5 rounds to finish the game
3. **Pump to Earn**: Each pump earns exponentially more points:
   - Pump 1: 10 points
   - Pump 2: 20 points
   - Pump 3: 40 points
   - Pump 4: 80 points
   - And so on...
4. **Risk Zone**: After 3 pumps, the balloon has a chance to pop!
   - Pop probability increases with each pump
   - If it pops, you lose all pending (un-banked) points
5. **Bank Points**: Safely bank your points and advance to the next round
6. **High Scores**: Beat your high score and climb the leaderboard!

## How It Works

This app uses the **quickstart configuration** from the Base Account SDK:

```tsx
const sdk = createBaseAccountSDK({
  appName: "Balloon Game",
  appChainIds: [baseSepolia.id],
  subAccounts: {
    creation: 'on-connect',    // Auto-create sub account on connect
    defaultAccount: 'sub',      // Use sub account for transactions by default
  }
});
```

### Key Benefits

- **No repeated popups**: Pump balloons without transaction approval spam
- **Seamless gameplay**: Sub account automatically accesses Universal Account balance
- **2-hour sessions**: Play freely for 2 hours without reconnecting
- **Perfect for gaming**: Ideal UX for apps requiring frequent transactions

## Usage

1. **Connect Wallet**: Click "🎮 Connect & Play" and approve the connection in your Base Account
2. **Sub Account Created**: A sub account is automatically created for this game (2-hour session)
3. **Start Game**: Pay 0.001 ETH to start a new game
4. **Play**:
   - Click "💨 PUMP" to inflate the balloon and earn points
   - Watch for the ⚠️ DANGER ZONE after 3 pumps
   - Click "🏦 Bank Points" to safely save your points and advance to the next round
5. **Complete 5 rounds** to finish the game and set your high score!

## Configuration

### Smart Contract

The game uses the BalloonGame contract deployed on Base Sepolia:

```tsx
const BALLOON_GAME_ADDRESS = "0x172Aee5D51D231DBFa9C0F5E09E68237471b185c";
```

### Game Parameters

- **Entry Fee**: 0.001 ETH
- **Rounds**: 5
- **Session Duration**: 2 hours
- **Pop Risk**: Starts after 3 pumps, increases with each additional pump

## Technical Architecture

### Sub Account Integration

The app uses Base's native sub-account system:

1. **On Connect**: Sub account is automatically created
2. **Session Management**: 2-hour session timer enforced client-side
3. **Transaction Flow**: All game actions use `wallet_sendCalls` from the sub account
4. **Balance Access**: Auto Spend Permissions allow sub account to access Universal Account ETH

### Smart Contract Integration

The game interacts with the BalloonGame contract through three main functions:

- `startGame()` - Payable function (0.001 ETH) to initialize a new game
- `pumpBalloon()` - Pump action with randomized pop probability
- `collectPoints()` - Bank pending points and advance to next round

### State Management

- **Local State**: Game state is tracked locally for instant UI updates
- **Contract State**: Authoritative state stored on-chain
- **Sync**: State is synced after each transaction completes

### Gasless Transactions (Optional)

While this demo doesn't include a paymaster by default, you can enable truly gasless transactions by:

1. Setting up a paymaster service (e.g., [Pimlico](https://www.pimlico.io/))
2. Adding the paymaster URL to the `capabilities` field in `wallet_sendCalls`:

```tsx
capabilities: {
  paymasterService: {
    url: "YOUR_PAYMASTER_URL",
  },
}
```

This would allow players to pay the 0.001 ETH entry fee while the app sponsor covers gas costs.

## Learn More

- [Base Account Documentation](https://docs.base.org/base-account)
- [Sub Accounts Guide](https://docs.base.org/base-account/improve-ux/sub-accounts)
- [Base Account SDK](https://github.com/base/account-sdk)
- [BalloonGame Contract](https://sepolia.basescan.org/address/0x172Aee5D51D231DBFa9C0F5E09E68237471b185c)

## Troubleshooting

### "Session expired"
Reconnect your wallet to create a new 2-hour session.

### "Insufficient funds"
Make sure your Universal Account has at least 0.001 ETH + gas on Base Sepolia.

### Transaction fails
Check that you're connected to Base Sepolia testnet. You can get test ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet).

## License

MIT

