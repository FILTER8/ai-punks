import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { isAddress } from 'viem';
import { rpcClient } from '../../clients';
import type { ToolErrorOutput } from '../../types';

export const schema = {
  contractAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid address',
    })
    .describe('The NFT contract address to fetch mint status for'),
};

export const metadata = {
  name: 'getMintStatus',
  description: 'Get the minting status and phase of an NFT contract',
  annotations: {
    title: 'NFT Mint Status',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 5,
  },
};

const contractAbi = [
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

export default async function getMintStatus({ contractAddress }: InferSchema<typeof schema>) {
  try {
    console.log('Fetching mint status for:', contractAddress);
    const publicClient = rpcClient();
    const mintStatus = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getMintStatus',
    }) as [any, number, any];

    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              contractAddress,
              status: {
                mintStart: Number(mintStatus[0].mintStart),
                publicMintPrice: mintStatus[0].publicMintPrice.toString(),
                maxSupply: Number(mintStatus[0].maxSupply),
                totalMinted: Number(mintStatus[0].totalMinted),
                collectorFee: mintStatus[0].collectorFee.toString(),
                isRevealed: mintStatus[0].isRevealed,
                isFreeMint: mintStatus[0].isFreeMint,
              },
              currentPhase: mintStatus[1],
              activePhase: {
                phaseType: mintStatus[2].phaseType,
                startTime: Number(mintStatus[2].startTime),
                endTime: Number(mintStatus[2].endTime),
                mintPrice: mintStatus[2].mintPrice.toString(),
                maxPerAddress: Number(mintStatus[2].maxPerAddress),
                maxSupply: Number(mintStatus[2].maxSupply),
                mintedInPhase: Number(mintStatus[2].mintedInPhase),
                allowlistRoot: mintStatus[2].allowlistRoot,
              },
            },
            null,
            2
          ),
        },
      ],
    };

    console.log('Mint status fetched:', response);
    return response;
  } catch (error) {
    console.error('Error in getMintStatus:', error);
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error fetching mint status: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      contractAddress,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorOutput, null, 2),
        },
      ],
    };
  }
}