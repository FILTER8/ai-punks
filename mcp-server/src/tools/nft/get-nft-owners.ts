import { z } from 'zod';
import { Address, isAddress } from 'viem';
import { alchemy } from '../../clients';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';
import { config } from '../../config';
import getCollectionNftCount from './get-collection-nft-count';

interface TopHolder {
  ownerAddress: Address;
  balance: number;
  tokenId: string;
  tokenMetadata: {
    nftImageUrl?: string | null;
    imageData?: string | null;
    traits?: { trait_type: string; value: string }[];
  };
}

interface NFTOwnersOutput {
  uniqueHolders: number;
  topHolders: TopHolder[];
  contractAddress: Address;
  timestamp: string;
  network: 'shape-mainnet' | 'shape-sepolia';
  chainId: number;
}

export const schema = {
  contractAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid contract address',
    })
    .default('0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6')
    .describe('The NFT contract address to get the unique holders count for'),
  topHoldersCount: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .default(1)
    .describe('Number of top holders to return (1 to 3)'),
};

export const metadata = {
  name: 'getNFTOwners',
  description: 'Get the number of unique holders and top holders for a specific NFT collection on Shape Mainnet or Sepolia.',
  annotations: {
    title: 'Get NFT Unique Holders and Top Holders',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 10, // 10 minutes
  },
};

export default async function getNFTOwners({
  contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6',
  topHoldersCount = 1,
}: {
  contractAddress?: string;
  topHoldersCount?: number;
}) {
  const cacheKey = `mcp:nftOwners:${config.chainId}:${contractAddress.toLowerCase()}:top${topHoldersCount}`;
  // Temporarily disable caching to ensure fresh data
  // const cached = await getCached(cacheKey);
  // if (cached) {
  //   return JSON.parse(cached);
  // }

  try {
    console.log('getNFTOwners chainId:', config.chainId, 'contractAddress:', contractAddress, 'topHoldersCount:', topHoldersCount);

    // Validate input
    schema.contractAddress.parse(contractAddress);
    if (topHoldersCount) schema.topHoldersCount.parse(topHoldersCount);

    // Fetch owners for the contract
    const response = await alchemy.nft.getOwnersForContract(contractAddress, {
      withTokenBalances: true,
    });

    const uniqueHolders = response.owners ? response.owners.length : 0;

    // Process top holders
    const topHolders: TopHolder[] = [];
    if (response.owners && topHoldersCount > 0) {
      // Sort owners by balance (descending), then by address (lexicographically) for ties
      const sortedOwners = response.owners
        .map((owner) => ({
          ownerAddress: owner.ownerAddress as Address,
          balance: owner.tokenBalances ? owner.tokenBalances.reduce((sum, tb) => sum + Number(tb.balance), 0) : 0,
          tokenBalances: owner.tokenBalances || [],
        }))
        .sort((a, b) => b.balance - a.balance || a.ownerAddress.localeCompare(b.ownerAddress))
        .slice(0, topHoldersCount);

      // Fetch metadata for one token per top holder
      for (const owner of sortedOwners) {
        const tokenId = owner.tokenBalances.length > 0 ? owner.tokenBalances[0].tokenId : null;
        let tokenMetadata = {
          nftImageUrl: null as string | null,
          imageData: null as string | null,
          traits: [] as { trait_type: string; value: string }[],
        };

        if (tokenId) {
          const metadataResponse = await getCollectionNftCount({ contractAddress, tokenId });
          if (metadataResponse?.content?.[0]?.type === 'text' && metadataResponse.content[0].text) {
            const metadata = JSON.parse(metadataResponse.content[0].text);
            tokenMetadata = {
              nftImageUrl: metadata.nftImageUrl || null,
              imageData: metadata.imageData || null,
              traits: metadata.traits || [],
            };
          }
        }

        topHolders.push({
          ownerAddress: owner.ownerAddress,
          balance: owner.balance,
          tokenId: tokenId || 'N/A',
          tokenMetadata,
        });
      }
    }

    console.log('Alchemy owners Response:', JSON.stringify(response, null, 2));

    const result: NFTOwnersOutput = {
      uniqueHolders,
      topHolders,
      contractAddress: contractAddress as Address,
      timestamp: new Date().toISOString(),
      network: config.chainId === 360 ? 'shape-mainnet' : 'shape-sepolia',
      chainId: config.chainId,
    };

    const responseOutput = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };

    // Re-enable caching once stable
    // await setCached(cacheKey, JSON.stringify(responseOutput), metadata.annotations.cacheTTL);

    return responseOutput;
  } catch (error) {
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error fetching unique holders: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      timestamp: new Date().toISOString(),
    };

    console.error('getNFTOwners Error:', error);

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