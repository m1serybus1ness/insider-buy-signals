'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, useSwitchChain, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { walletClientToSigner, getSigner, getReadOnlyProvider } from '@/lib/provider'
import { sepolia } from 'wagmi/chains'
import { formatEther, parseEther } from 'viem'

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000').trim()

const CONTRACT_ABI = [
  'function createListing(string memory _description, uint256 _price, bytes32 _encryptedSignal) external returns (uint256)',
  'function purchaseSignal(uint256 _listingId) external payable',
  'function getListing(uint256 _listingId) external view returns (address seller, string memory description, uint256 price, uint256 createdAt, bool isActive, uint256 purchaseCount)',
  'function getListingEncryptedSignal(uint256 _listingId) external view returns (bytes32)',
  'function getSellerListings(address _seller) external view returns (uint256[])',
  'function getBuyerPurchases(address _buyer) external view returns (uint256[])',
  'function getActiveListings(uint256 _limit) external view returns (uint256[])',
  'function deactivateListing(uint256 _listingId) external',
  'function hasUserPurchased(uint256 _listingId, address _user) external view returns (bool)',
  'function rateSeller(address _seller, int256 _rating) external',
  'function getSellerRating(address _seller) external view returns (int256 totalRating, uint256 voteCount)',
  'function hasRatedSeller(address _seller, address _rater) external view returns (bool)',
  'function listingCounter() external view returns (uint256)',
  'event ListingCreated(uint256 indexed listingId, address indexed seller, string description, uint256 price)',
  'event SignalPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price)',
  'event ListingDeactivated(uint256 indexed listingId, address indexed seller)',
  'event SellerRated(address indexed seller, address indexed rater, int256 rating)',
]

type Tab = 'SIGNALS' | 'SELL' | 'SELLERS' | 'ABOUT'

interface Listing {
  id: number
  seller: string
  description: string
  price: string
  createdAt: number
  isActive: boolean
  purchaseCount: number
  hasPurchased?: boolean
}

interface Seller {
  address: string
  listingCount: number
  totalRating: number
  voteCount: number
  hasRated?: boolean
}

export default function InsiderBuySignals() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChain } = useSwitchChain()
  const chainId = useChainId()

  const [activeTab, setActiveTab] = useState<Tab>('SIGNALS')
  const [listings, setListings] = useState<Listing[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [relayerInstance, setRelayerInstance] = useState<any>(null)
  const [isRelayerLoading, setIsRelayerLoading] = useState(false)

  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newSignal, setNewSignal] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initRelayer()
    }
  }, [])

  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id })
    }
  }, [isConnected, chainId, switchChain])

  useEffect(() => {
    if (isConnected && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      loadListings()
      loadSellers()
    }
  }, [isConnected, address])

  const initRelayer = async () => {
    setIsRelayerLoading(true)
    try {
      const relayerModule: any = await Promise.race([
        import('@zama-fhe/relayer-sdk/web'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Relayer load timeout')), 10000))
      ])

      const sdkInitialized = await Promise.race([
        relayerModule.initSDK(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 10000))
      ])
      
      if (!sdkInitialized) {
        throw new Error('SDK initialization failed')
      }

      const instance = await Promise.race([
        relayerModule.createInstance(relayerModule.SepoliaConfig),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Instance creation timeout')), 10000))
      ])
      
      setRelayerInstance(instance)
    } catch (error) {
      console.error('Failed to initialize relayer:', error)
    } finally {
      setIsRelayerLoading(false)
    }
  }

  // Encrypt string using FHE
  const encryptString = async (text: string): Promise<string> => {
    if (!relayerInstance || !address) {
      throw new Error('Relayer not initialized or wallet not connected')
    }

    // Convert string to number by hashing and taking modulo 2^31 - 1
    const hash = ethers.keccak256(ethers.toUtf8Bytes(text))
    const hashBigInt = BigInt(hash)
    const maxValue = BigInt(2 ** 31 - 1)
    const value = Number(hashBigInt % maxValue)

    const inputBuilder = relayerInstance.createEncryptedInput(
      CONTRACT_ADDRESS,
      address
    )
    inputBuilder.add32(value)

    const encryptedInput = await Promise.race([
      inputBuilder.encrypt(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Encryption timeout')), 30000)
      )
    ]) as any

    if (!encryptedInput?.handles || encryptedInput.handles.length === 0) {
      throw new Error('Encryption failed')
    }

    return encryptedInput.handles[0]
  }

  const getEthersSigner = async () => {
    if (walletClient) {
      return await walletClientToSigner(walletClient)
    }
    return await getSigner()
  }

  const loadListings = async () => {
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      
      const listingIds = await contract.getActiveListings(100)
      const listingPromises = listingIds.map(async (id: bigint) => {
        const listingData = await contract.getListing(id)
        let hasPurchased = false
        if (address) {
          hasPurchased = await contract.hasUserPurchased(id, address)
        }
        return {
          id: Number(id),
          seller: listingData[0],
          description: listingData[1],
          price: formatEther(listingData[2]),
          createdAt: Number(listingData[3]),
          isActive: listingData[4],
          purchaseCount: Number(listingData[5]),
          hasPurchased
        }
      })
      
      const loadedListings = await Promise.all(listingPromises)
      setListings(loadedListings.reverse())
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  const loadSellers = async () => {
    try {
      const provider = getReadOnlyProvider()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      
      const sellerAddresses = new Set<string>()
      for (const listing of listings) {
        sellerAddresses.add(listing.seller.toLowerCase())
      }
      
      const sellerPromises = Array.from(sellerAddresses).map(async (sellerAddr) => {
        const sellerListings = await contract.getSellerListings(sellerAddr)
        const ratingData = await contract.getSellerRating(sellerAddr)
        let hasRated = false
        if (address) {
          hasRated = await contract.hasRatedSeller(sellerAddr, address)
        }
        return {
          address: sellerAddr,
          listingCount: sellerListings.length,
          totalRating: Number(ratingData[0]),
          voteCount: Number(ratingData[1]),
          hasRated
        }
      })
      
      const loadedSellers = await Promise.all(sellerPromises)
      loadedSellers.sort((a, b) => {
        const aAvg = a.voteCount > 0 ? a.totalRating / a.voteCount : 0
        const bAvg = b.voteCount > 0 ? b.totalRating / b.voteCount : 0
        if (Math.abs(bAvg - aAvg) < 0.01) {
          return b.voteCount - a.voteCount
        }
        return bAvg - aAvg
      })
      setSellers(loadedSellers)
    } catch (error) {
      console.error('Failed to load sellers:', error)
    }
  }

  useEffect(() => {
    if (listings.length > 0 && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      loadSellers()
    }
  }, [listings.length, address])

  const createListing = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    if (!relayerInstance) {
      alert('FHE relayer is not ready. Please wait...')
      return
    }

    if (!newDescription.trim() || !newPrice.trim() || !newSignal.trim()) {
      alert('Please fill in all fields')
      return
    }

    const price = parseFloat(newPrice)
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price')
      return
    }

    setIsLoading(true)
    try {
      // Encrypt signal using FHE
      const encryptedSignal = await encryptString(newSignal.trim())

      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.createListing(
        newDescription.trim(),
        parseEther(newPrice),
        encryptedSignal
      )
      await tx.wait()

      setNewDescription('')
      setNewPrice('')
      setNewSignal('')
      
      await loadListings()
      alert('Listing created successfully')
    } catch (error: any) {
      console.error('Failed to create listing:', error)
      alert(`Failed to create listing: ${error.reason || error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const purchaseSignal = async (listingId: number, price: string) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.purchaseSignal(listingId, {
        value: parseEther(price)
      })

      await tx.wait()

      await loadListings()
      alert('Signal purchased successfully')
    } catch (error: any) {
      console.error('Failed to purchase signal:', error)
      alert(`Failed to purchase signal: ${error.reason || error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const rateSeller = async (sellerAddress: string, rating: number) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    setIsLoading(true)
    try {
      const signer = await getEthersSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.rateSeller(sellerAddress, rating)
      await tx.wait()

      await loadSellers()
      alert('Rating submitted')
    } catch (error: any) {
      console.error('Failed to rate seller:', error)
      alert(`Failed to rate seller: ${error.reason || error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-light text-blue-600">insider buy signals</h1>
          <ConnectButton />
        </div>

        <div className="flex gap-8 mb-12 border-b border-blue-200">
          <button
            onClick={() => setActiveTab('SIGNALS')}
            className={`pb-4 px-2 font-light text-lg transition-colors ${
              activeTab === 'SIGNALS'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            signals$
          </button>
          <button
            onClick={() => setActiveTab('SELL')}
            className={`pb-4 px-2 font-light text-lg transition-colors ${
              activeTab === 'SELL'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            sell signal$
          </button>
          <button
            onClick={() => setActiveTab('SELLERS')}
            className={`pb-4 px-2 font-light text-lg transition-colors ${
              activeTab === 'SELLERS'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            sellers$
          </button>
          <button
            onClick={() => setActiveTab('ABOUT')}
            className={`pb-4 px-2 font-light text-lg transition-colors ${
              activeTab === 'ABOUT'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            about$
          </button>
        </div>

        {activeTab === 'SIGNALS' && (
          <div className="space-y-6">
            {listings.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p>No signals available</p>
              </div>
            ) : (
              listings.map((listing) => (
                <div key={listing.id} className="border-b border-gray-200 pb-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-lg mb-2">{listing.description}</p>
                      <p className="text-sm text-gray-500">
                        {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)} • {listing.purchaseCount} purchases
                      </p>
                    </div>
                    <div className="text-right ml-8">
                      <p className="text-lg font-light mb-3 text-blue-600">
                        {listing.price} ETH
                      </p>
                      {listing.hasPurchased ? (
                        <span className="text-sm text-gray-400">Purchased</span>
                      ) : listing.seller.toLowerCase() === address?.toLowerCase() ? (
                        <span className="text-sm text-gray-400">Your listing</span>
                      ) : (
                        <button
                          onClick={() => purchaseSignal(listing.id, listing.price)}
                          disabled={isLoading || !isConnected}
                          className="px-6 py-2 bg-blue-600 text-white text-sm font-light hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? 'Processing...' : 'Buy'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'SELL' && (
          <div className="max-w-2xl">
            <div className="space-y-6">
              <div>
                <label className="block mb-2 text-sm text-gray-600">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="BTC buy signal, ETH price prediction..."
                  className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:border-blue-600 text-gray-900"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-600">Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.01"
                  className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:border-blue-600 text-gray-900"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-600">Signal</label>
                <textarea
                  value={newSignal}
                  onChange={(e) => setNewSignal(e.target.value)}
                  placeholder="Enter your trading signal..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:border-blue-600 text-gray-900"
                />
              </div>
              <button
                onClick={createListing}
                disabled={isLoading || !isConnected || !relayerInstance}
                className="px-8 py-3 bg-blue-600 text-white font-light hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Listing'}
              </button>
              {!isRelayerLoading && !relayerInstance && (
                <div className="mt-4 bg-red-100 border border-red-400 rounded p-3">
                  <p className="text-red-800 text-sm">FHE encryption system failed to initialize. Please refresh the page.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SELLERS' && (
          <div className="space-y-6">
            {sellers.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p>No sellers available</p>
              </div>
            ) : (
              sellers.map((seller) => {
                const avgRating = seller.voteCount > 0 ? (seller.totalRating / seller.voteCount).toFixed(2) : '0.00'
                const ratingNum = parseFloat(avgRating)
                return (
                  <div key={seller.address} className="border-b border-gray-200 pb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg mb-1">{seller.address.slice(0, 6)}...{seller.address.slice(-4)}</p>
                        <p className="text-sm text-gray-500">
                          {seller.listingCount} listings • Rating: {ratingNum > 0 ? '+' : ''}{avgRating} ({seller.voteCount} votes)
                        </p>
                      </div>
                      {isConnected && address && address.toLowerCase() !== seller.address && !seller.hasRated && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => rateSeller(seller.address, 1)}
                            disabled={isLoading}
                            className="px-4 py-1 text-sm border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            +
                          </button>
                          <button
                            onClick={() => rateSeller(seller.address, -1)}
                            disabled={isLoading}
                            className="px-4 py-1 text-sm border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            -
                          </button>
                        </div>
                      )}
                      {seller.hasRated && (
                        <span className="text-sm text-gray-400">Rated</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'ABOUT' && (
          <div className="max-w-3xl space-y-6 text-gray-700 leading-relaxed">
            <div>
              <h2 className="text-xl font-light mb-4 text-blue-600">About</h2>
              <p className="mb-4">
                Insider Buy Signals is a marketplace for buying and selling encrypted crypto trading signals.
              </p>
              <p className="mb-4">
                Sellers can create listings with trading signals and set prices in ETH. Signals are encrypted before being stored on-chain using FHE (Fully Homomorphic Encryption).
              </p>
              <p className="mb-4">
                Buyers can browse available signals, purchase them, and rate sellers based on signal quality.
              </p>
              <p>
                All transactions are conducted on the Sepolia testnet. Connect your wallet to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
