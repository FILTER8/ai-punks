import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { isAddress } from 'viem';
import { addresses } from '../../addresses';
import { config } from '../../config';
import { alchemy } from '../../clients';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';

export const schema = {
  userAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid address',
    })
    .describe('The user wallet address to fetch minting history for'),
  contractAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid contract address',
    })
    .describe('The NFT contract address to query minting history for')
    .default(addresses.nftMinter[config.chainId]),
};

export const metadata = {
  name: 'getMintHistory',
  description: 'Fetch the minting history (token IDs and timestamps) for a user’s address from an NFT contract',
  annotations: {
    title: 'NFT Minting History',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 5, // 5 minutes
  },
};

export default async function getMintHistory({ userAddress, contractAddress }: InferSchema<typeof schema>) {
  const cacheKey = `mcp:mintHistory:${config.chainId}:${contractAddress.toLowerCase()}:${userAddress.toLowerCase()}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  try {
    // Query Transfer events from address(0) to userAddress (indicating mints)
    const logs = await alchemy.core.getLogs({
      address: contractAddress,
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event
        '0x0000000000000000000000000000000000000000000000000000000000000000', // from: address(0)
        `0x000000000000000000000000${userAddress.slice(2).toLowerCase()}`, // to: userAddress
      ],
      fromBlock: '0x0',
      toBlock: 'latest',
    });

    const mintHistory = logs.map((log) => ({
      tokenId: parseInt(log.topics[3], 16).toString(),
      transactionHash: log.transactionHash,
      blockNumber: parseInt(log.blockNumber, 16),
      timestamp: new Date().toISOString(), // Note: Use block timestamp for accuracy
    }));

    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              userAddress,
              contractAddress,
              mints: mintHistory,
              totalMinted: mintHistory.length,
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
      message: `Error fetching mint history: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      userAddress,
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