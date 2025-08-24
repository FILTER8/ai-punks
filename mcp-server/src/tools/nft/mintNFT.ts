import { z } from 'zod';
import { Address, isAddress, createPublicClient, http, defineChain } from 'viem';

// Define custom Shape Mainnet chain
const shapeMainnet = defineChain({
  id: 360,
  name: 'Shape Mainnet',
  network: 'shape',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [`https://shape-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`],
    },
    public: {
      http: [`https://shape-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`],
    },
  },
  blockExplorers: {
    default: {
      name: 'ShapeScan',
      url: 'https://shapescan.xyz',
    },
  },
  contracts: {
    multicall3: {
      address: '0xYourMulticall3Address', // Replace with actual multicall3 address if needed
      blockCreated: 0, // Adjust based on Shape Mainnet's block
    },
  },
});

const MINTBAY_GENERATIVE_ABI = [
  {
    "inputs": [],
    "name": "getMintStatus",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "mintStart", "type": "uint256" },
          { "internalType": "uint256", "name": "publicMintPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "maxSupply", "type": "uint256" },
          { "internalType": "uint256", "name": "totalMinted", "type": "uint256" },
          { "internalType": "uint256", "name": "collectorFee", "type": "uint256" },
          { "internalType": "bool", "name": "isRevealed", "type": "bool" },
          { "internalType": "bool", "name": "isFreeMint", "type": "bool" }
        ],
        "internalType": "struct MintStatus",
        "name": "status",
        "type": "tuple"
      },
      { "internalType": "enum MintPhase", "name": "currentPhaseType", "type": "uint8" },
      {
        "components": [
          { "internalType": "enum MintPhase", "name": "phaseType", "type": "uint8" },
          { "internalType": "uint256", "name": "startTime", "type": "uint256" },
          { "internalType": "uint256", "name": "endTime", "type": "uint256" },
          { "internalType": "uint256", "name": "mintPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "maxPerAddress", "type": "uint256" },
          { "internalType": "uint256", "name": "maxSupply", "type": "uint256" },
          { "internalType": "uint256", "name": "mintedInPhase", "type": "uint256" },
          { "internalType": "bytes32", "name": "allowlistRoot", "type": "bytes32" }
        ],
        "internalType": "struct Phase",
        "name": "activePhase",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6';
const MINT_PRICE = BigInt('2600000000000000'); // 0.0026 ETH
const COLLECTOR_FEE = BigInt('400000000000000'); // 0.0004 ETH
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const CHAIN_ID = 360;

export const schema = {
  owner: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid wallet address',
    })
    .describe('The wallet address to mint the NFT to'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(1)
    .default(1)
    .describe('Number of NFTs to mint (currently fixed to 1)'),
};

export const metadata = {
  name: 'mintNFT',
  description: 'Validate mint request for The Medalists collection on Shape Mainnet.',
  annotations: {
    title: 'Validate Mint NFT',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    requiresWallet: false,
    category: 'nft-minting',
    educationalHint: true,
    cacheTTL: 0,
  },
};

interface MintNFTOutput {
  message: string;
  error?: string;
}

export default async function mintNFT({
  owner,
  quantity = 1,
}: {
  owner: string;
  quantity?: number;
}) {
  const cacheKey = `mcp:mintNFT:${CHAIN_ID}:${CONTRACT_ADDRESS.toLowerCase()}:${owner.toLowerCase()}:${quantity}`;
  
  try {
    console.log('Starting mintNFT validation:', { chainId: CHAIN_ID, owner, quantity, contractAddress: CONTRACT_ADDRESS });

    // Validate inputs
    schema.owner.parse(owner);
    schema.quantity.parse(quantity);
    console.log('Inputs validated:', { owner, quantity });

    // Validate ALCHEMY_API_KEY
    if (!ALCHEMY_API_KEY) {
      console.log('ALCHEMY_API_KEY is missing');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Alchemy API key is missing. Please configure the ALCHEMY_API_KEY environment variable.' }, null, 2),
        }],
      };
    }

    // Create public client for contract interaction
    const publicClient = createPublicClient({
      chain: shapeMainnet,
      transport: http(`https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, { retryCount: 3, timeout: 10000 }),
    });
    console.log('Public client created:', { chainId: CHAIN_ID });

    // Fetch mint status
    const mintStatus = await publicClient.readContract({
      address: CONTRACT_ADDRESS as Address,
      abi: MINTBAY_GENERATIVE_ABI,
      functionName: 'getMintStatus',
    }) as [any, number, any];
    const { publicMintPrice, collectorFee, maxSupply, totalMinted, isFreeMint } = mintStatus[0];
    const currentPhaseType = mintStatus[1];
    const activePhase = mintStatus[2];

    console.log('Mint Status:', { publicMintPrice, collectorFee, maxSupply, totalMinted, isFreeMint, currentPhaseType, phaseId: activePhase.phaseType });

    if (currentPhaseType !== 2 || activePhase.phaseType !== 2) { // MintPhase.Public = 2
      console.log('Mint phase validation failed:', { currentPhaseType, phaseType: activePhase.phaseType });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Minting is not active. Current phase is not public.' }, null, 2),
        }],
      };
    }

    if (publicMintPrice !== MINT_PRICE) {
      console.log('Mint price validation failed:', { expected: MINT_PRICE, got: publicMintPrice });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Invalid mint price. Expected ${MINT_PRICE}, got ${publicMintPrice}.` }, null, 2),
        }],
      };
    }

    if (collectorFee !== COLLECTOR_FEE) {
      console.log('Collector fee validation failed:', { expected: COLLECTOR_FEE, got: collectorFee });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Invalid collector fee. Expected ${COLLECTOR_FEE}, got ${collectorFee}.` }, null, 2),
        }],
      };
    }

    if (totalMinted + BigInt(quantity) > maxSupply) {
      console.log('Max supply validation failed:', { totalMinted, quantity, maxSupply });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Minting exceeds max supply of 2025.' }, null, 2),
        }],
      };
    }

    const result: MintNFTOutput = {
      message: `Mint request validated. Click the Mint button to proceed with minting 1 NFT to ${owner}.`,
    };

    console.log('Mint validation result:', result);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    const errorOutput: { error: string; message: string } = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: `Error validating mint request: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
    };

    console.error('mintNFT Error:', error);
    console.error('Error details:', errorOutput);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(errorOutput, null, 2),
      }],
    };
  }
}