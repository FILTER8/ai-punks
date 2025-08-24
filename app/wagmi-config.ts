import { createConfig, http } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { Chain } from 'wagmi/chains';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Define the Shape network
const shapeNetwork: Chain = {
  id: 360,
  name: 'Shape Network',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [`https://shape-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`] },
  },
  blockExplorers: {
    default: { name: 'ShapeScan', url: 'https://shapescan.xyz' },
  },
};

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  networks: [shapeNetwork],
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
});

// Create Wagmi configuration
export const wagmiConfig = createConfig({
  chains: [shapeNetwork],
  transports: {
    [shapeNetwork.id]: http(),
  },
});

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [shapeNetwork],
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  metadata: {
    name: 'The Medalists NFT Chatbot',
    description: 'Interact with The Medalists NFT Collection on Shape Network',
    url: 'https://your-app-url.com', // Replace with your app’s URL
    icons: ['https://your-app-url.com/icon.png'], // Replace with your app’s icon
  },
  features: {
    analytics: false,
  },
});