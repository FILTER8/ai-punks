import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { isAddress } from 'viem';
import { addresses } from '../../addresses';
import { config } from '../../config';
import { rpcClient } from '../../clients';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';

export const schema = {
  userAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid address',
    })
    .describe('The user wallet address to check for NFT ownership'),
};

export const metadata = {
  name: 'checkHolderStatus',
  description: 'Check if a user holds an NFT from the specified contract',
  annotations: {
    title: 'NFT Holder Status',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 5, // 5 minutes
  },
};

const contractAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export default async function checkHolderStatus({ userAddress }: InferSchema<typeof schema>) {
  const cacheKey = `mcp:holderStatus:${config.chainId}:${userAddress.toLowerCase()}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const publicClient = rpcClient();
    const balance = await publicClient.readContract({
      address: addresses.nftMinter[config.chainId] as `0x${string}`,
      abi: contractAbi,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;

    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              userAddress,
              isHolder: balance > 0n,
            },
            null,
            2
          ),
        },
      ],
    };

    await setCached(cacheKey, JSON.stringify(response), metadata.annotations.cacheTTL);

    return response;
  } catch (error) {
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error checking holder status: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      userAddress,
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