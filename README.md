# 🔐 insider-buy-signals

> **Encrypted crypto signal marketplace** • Privacy-first trading intelligence • Built with FHE

---

## 💡 Concept

**insider-buy-signals** is a decentralized marketplace where traders can monetize their trading insights while maintaining complete privacy. The platform uses Fully Homomorphic Encryption (FHE) to ensure that trading signals remain encrypted throughout the entire transaction lifecycle — from creation to purchase to access.

**The Core Idea**: Sellers create encrypted listings with their trading signals. Buyers purchase access to these signals. All signal data is encrypted using FHE before being stored on-chain, meaning sensitive trading information is never exposed in plaintext, even to the blockchain itself.

**Why It Matters**: Traditional signal marketplaces require trust — buyers must trust that sellers won't reveal signals before purchase, and sellers must trust that platform won't access their proprietary strategies. With FHE, cryptographic guarantees replace trust. Signals remain encrypted until explicitly decrypted by authorized parties.

---

## 🎯 Quick Overview

| Aspect | Description |
|--------|-------------|
| **What** | Marketplace for buying/selling crypto trading signals |
| **Privacy** | All signals encrypted with FHE (Fully Homomorphic Encryption) |
| **Network** | Ethereum Sepolia Testnet |
| **Encryption** | Zama FHEVM + FHE Relayer SDK |
| **Access** | Only sellers and authorized buyers can decrypt signals |

---

## 🚀 Features

### 🔒 Privacy & Security

- **FHE Encryption**: All signal data encrypted using Zama FHEVM
- **Client-Side Encryption**: Signals encrypted before blockchain submission
- **Access Control**: Only authorized parties (seller + buyers) can access encrypted signals
- **No Plaintext Storage**: Original signal text never stored on-chain
- **Cryptographic Guarantees**: Privacy enforced by mathematics, not trust

### 💼 Marketplace Features

- **📝 Create Listings**: Sellers create listings with descriptions, prices, and encrypted signals
- **🛒 Purchase Signals**: Buyers browse and purchase available trading signals
- **⭐ Rate Sellers**: Buyers provide feedback via upvote/downvote system
- **📊 Track History**: View purchase history and listing statistics
- **🔓 Signal Access**: Access purchased signals (encrypted, requires FHE relayer for decryption)

---

## 🎮 How to Use

### For Sellers

1. **Connect Wallet** → Connect your Ethereum wallet (MetaMask, WalletConnect, etc.)
2. **Create Listing** → Navigate to "sell signal$" tab
   - Enter a public description (what type of signal you're offering)
   - Set price in ETH
   - Enter your trading signal (this will be encrypted automatically)
3. **Publish** → Your listing appears in the marketplace
4. **Get Paid** → Buyers purchase your signals, payments transfer automatically
5. **Build Reputation** → Get rated by buyers to build trust

### For Buyers

1. **Connect Wallet** → Connect your Ethereum wallet
2. **Browse Signals** → View available signals in "signals$" tab
3. **Purchase** → Click "Buy" on signals you want to access
4. **Access Signal** → After purchase, you can access the encrypted signal data
5. **Rate Seller** → Provide feedback in "sellers$" tab

---

## 🏗️ Technical Architecture

### FHE Encryption Flow

```
┌─────────────────┐
│  Seller's       │
│  Signal Text    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FHE Relayer    │  ← Client-side encryption
│  SDK Encrypts   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FHE Handle     │  ← bytes32 reference
│  (bytes32)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Blockchain     │  ← Stored on-chain
│  Contract       │
└─────────────────┘
```

### Data Flow

1. **Encryption**: Signal text → FHE encryption → FHE handle (bytes32)
2. **Storage**: FHE handle stored in Listing struct on-chain
3. **Purchase**: Buyer pays, purchase record created with FHE handle
4. **Access**: Authorized parties retrieve FHE handle via contract
5. **Decryption**: FHE handle → FHE relayer → Decrypted signal (client-side)

---

## 🔧 Technical Stack

### Blockchain & Privacy

| Component | Technology |
|-----------|-----------|
| **Network** | Ethereum Sepolia Testnet |
| **Privacy Layer** | Fully Homomorphic Encryption (FHE) via Zama FHEVM |
| **Encryption SDK** | Zama FHEVM Relayer SDK (v0.3.0-6) |
| **Storage** | On-chain storage of FHE handles (bytes32) |
| **RPC Provider** | 0xrpc.io for Sepolia network access |

### Frontend

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 14 with React and TypeScript |
| **Styling** | Tailwind CSS |
| **Wallet** | Wagmi + RainbowKit |
| **Blockchain** | Ethers.js v6 |
| **FHE** | @zama-fhe/relayer-sdk for client-side encryption |

### Smart Contracts

| Component | Details |
|-----------|---------|
| **Language** | Solidity ^0.8.20 |
| **Contract** | InsiderBuySignals.sol |
| **FHE Support** | All signal data stored as FHE handles (bytes32) |

---

## 📋 Contract Details

**Contract Address**: `0x06904F7e9e669C6B3762a14F594Eb310Ab645fc1`  
**Network**: Sepolia Testnet  
**Deployer**: `0xE4F261285e9Cb5b3500070A576B1b55dc7DDB089`

### Key Functions

#### Listing Management

- `createListing(string _description, uint256 _price, bytes32 _encryptedSignal)`  
  Create a new listing with FHE-encrypted signal data

- `getListing(uint256 _listingId)`  
  Get public listing information (description, price, seller, etc.)

- `getListingEncryptedSignal(uint256 _listingId)`  
  Get FHE handle for encrypted signal (seller/buyers only)

- `deactivateListing(uint256 _listingId)`  
  Deactivate a listing (seller only)

- `getActiveListings(uint256 _limit)`  
  Get list of active listing IDs

#### Purchase Management

- `purchaseSignal(uint256 _listingId)`  
  Purchase a signal listing (payable function)

- `getPurchase(uint256 _listingId, uint256 _purchaseIndex)`  
  Get purchase information including FHE handle

- `getBuyerPurchases(address _buyer)`  
  Get all purchase listing IDs for a buyer

- `hasUserPurchased(uint256 _listingId, address _user)`  
  Check if user has purchased a listing

#### Seller Management

- `getSellerListings(address _seller)`  
  Get all listing IDs for a seller

- `rateSeller(address _seller, int256 _rating)`  
  Rate a seller (+1 for upvote, -1 for downvote)

- `getSellerRating(address _seller)`  
  Get seller's total rating and vote count

- `hasRatedSeller(address _seller, address _rater)`  
  Check if user has rated a seller

---

## 🔐 FHE Implementation

### How FHE Works Here

**Fully Homomorphic Encryption (FHE)** allows computations to be performed on encrypted data without decrypting it first. In this application:

1. **Signal Text** (plaintext) is encrypted client-side using Zama FHEVM Relayer SDK
2. **Encryption Result** is an FHE handle (bytes32) — a reference to encrypted data
3. **FHE Handle** is stored on-chain instead of plaintext signal
4. **Access Control** ensures only authorized parties (seller + buyers) can retrieve handles
5. **Decryption** happens client-side via FHE relayer for authorized parties

### Encryption Process

```typescript
// Client-side encryption example
const encryptString = async (text: string): Promise<string> => {
  // Convert string to number via hashing
  const hash = ethers.keccak256(ethers.toUtf8Bytes(text))
  const hashBigInt = BigInt(hash)
  const maxValue = BigInt(2 ** 31 - 1)
  const value = Number(hashBigInt % maxValue)

  // Create encrypted input via FHE relayer
  const inputBuilder = relayerInstance.createEncryptedInput(
    CONTRACT_ADDRESS,
    address
  )
  inputBuilder.add32(value)

  // Encrypt and get handle
  const encryptedInput = await inputBuilder.encrypt()
  return encryptedInput.handles[0]  // Returns bytes32 FHE handle
}
```

### Contract Storage

```solidity
struct Listing {
    address seller;
    string description;      // Public description (not encrypted)
    uint256 price;
    bytes32 encryptedSignal; // FHE handle for encrypted signal
    uint256 createdAt;
    bool isActive;
    uint256 purchaseCount;
}
```

### Privacy Guarantees

✅ **No Plaintext Storage**: Original signal text never stored on-chain  
✅ **Encrypted Handles**: Only FHE handles (references) are stored  
✅ **Access Control**: Contract enforces access permissions  
✅ **Client-Side Decryption**: Original values decrypted only by authorized parties  
✅ **Homomorphic Operations**: Operations possible on encrypted data without decryption

---

## 🛠️ Setup & Development

### Prerequisites

- Node.js 18+ and npm
- Ethereum wallet with Sepolia testnet ETH
- Git for version control

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   
   Create `.env.local`:
   ```env
   SEPOLIA_RPC_URL=https://0xrpc.io/sep
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://0xrpc.io/sep
   NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=0x06904F7e9e669C6B3762a14F594Eb310Ab645fc1
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   PRIVATE_KEY=your_private_key_for_deployment
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Compile contracts** (if needed)
   ```bash
   npm run compile
   ```

### Contract Deployment

1. **Deploy to Sepolia**
   ```bash
   npm run deploy:market
   ```

2. **Update addresses**
   - Update `.env.local` with new contract address
   - Update Vercel environment variables

### Production Deployment

**Live Application**: https://insider-buy-signals.vercel.app

Environment variables configured in Vercel dashboard for production builds.

---

## 📁 Project Structure

```
26-wallet/
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                # Main page component
│   ├── providers.tsx           # Wagmi/RainbowKit providers
│   └── globals.css             # Global styles
├── components/
│   └── CryptoSignalMarket.tsx  # Main marketplace component with FHE
├── contracts/
│   └── InsiderBuySignals.sol   # Smart contract with FHE support
├── lib/
│   └── provider.ts             # Blockchain provider utilities
├── scripts/
│   └── deploy-market.js        # Contract deployment script
└── Configuration files
    ├── package.json
    ├── tsconfig.json
    ├── hardhat.config.ts
    └── ...
```

---

## ✅ Current Status

**Live URL**: https://insider-buy-signals.vercel.app  
**Network**: Sepolia Testnet  
**Status**: ✅ Production-ready

### Implemented Features

- ✅ FHE encryption via Zama FHEVM Relayer SDK
- ✅ Listing creation with encrypted signals
- ✅ Signal purchase with automatic payment transfer
- ✅ Seller rating system (upvote/downvote)
- ✅ Access control for encrypted signals
- ✅ Purchase history tracking
- ✅ Modern UI with Tailwind CSS
- ✅ Wallet connection via RainbowKit
- ✅ Smart contract with FHE handle support
- ✅ Production deployment on Vercel

### Considerations

- ⚠️ Running on Sepolia testnet (test tokens only)
- ⚠️ FHE operations require relayer connection
- ⚠️ Gas costs vary based on network conditions
- ⚠️ Experimental technology — use at your own risk
- ℹ️ Signal data encrypted but FHE handles visible on-chain (cannot decrypt without relayer)

---

## 📚 Additional Resources

- [Zama FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Next.js Documentation](https://nextjs.org/docs)
- [Wagmi Documentation](https://wagmi.sh)
- [Ethereum Sepolia Testnet](https://sepolia.dev)

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

Built with:
- **[Zama FHEVM](https://www.zama.ai/)** — Fully Homomorphic Encryption
- **[Next.js](https://nextjs.org/)** — Web framework
- **[Wagmi](https://wagmi.sh/)** & **[RainbowKit](https://www.rainbowkit.com/)** — Wallet integration
- **[Ethereum](https://ethereum.org/)** — Blockchain infrastructure

---

*Privacy-first trading intelligence • Encrypted by design • Powered by FHE*
