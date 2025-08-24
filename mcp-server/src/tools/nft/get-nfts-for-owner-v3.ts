import { z } from 'zod';
import { Address, isAddress } from 'viem';
import { alchemy } from '../../clients';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';
import { config } from '../../config';

interface NFT {
  tokenId: string;
  name?: string;
  imageUrl?: string | null;
  attributes?: { trait_type: string; value: string }[];
}

interface NFTsForOwnerOutput {
  nfts: NFT[];
  totalCount: number;
  contractAddress: Address;
  timestamp: string;
  network: 'shape-mainnet' | 'shape-sepolia';
  chainId: number;
  tokenId?: string;
  owner: string;
}

export const schema = {
  owner: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid wallet address',
    })
    .describe('The wallet address to fetch NFTs for'),
  contractAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid contract address',
    })
    .default('0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6')
    .describe('The NFT contract address to query'),
  tokenId: z
    .string()
    .regex(/^\d+$/, { message: 'Token ID must be a positive integer' })
    .optional()
    .describe('The token ID to fetch a specific NFT'),
};

export const metadata = {
  name: 'getNFTsForOwnerV3',
  description: 'Get all NFTs owned by a wallet address for a specific collection on Shape Mainnet or Sepolia, with optional token ID filtering.',
  annotations: {
    title: 'Get NFTs for Owner',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 10, // 10 minutes
  },
};

export default async function getNFTsForOwnerV3({
  owner,
  contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6',
  tokenId,
}: {
  owner: string;
  contractAddress?: string;
  tokenId?: string;
}) {
  const cacheKey = `mcp:nftsForOwner:${config.chainId}:${contractAddress.toLowerCase()}:${owner.toLowerCase()}:${tokenId || 'no-token'}`;
  // Temporarily disable caching to ensure fresh data
  // const cached = await getCached(cacheKey);
  // if (cached) {
  //   return JSON.parse(cached);
  // }

  try {
    console.log('getNFTsForOwnerV3 chainId:', config.chainId, 'owner:', owner, 'contractAddress:', contractAddress); // Debug log

    // Validate inputs
    schema.owner.parse(owner);
    schema.contractAddress.parse(contractAddress);
    if (tokenId) schema.tokenId.parse(tokenId);

    // Fetch NFTs for the owner
    const response = await alchemy.nft.getNftsForOwner(owner, {
      contractAddresses: [contractAddress],
      pageSize: 100, // Adjust as needed
      withMetadata: true,
    });

const nfts: NFT[] = response.ownedNfts
  .filter((nft) => !tokenId || nft.tokenId === tokenId)
  .map((nft) => {
    const imageUrl =
      nft.image?.cachedUrl ||
      nft.imageUrl ||
      (Array.isArray(nft.media) && nft.media.length > 0 ? nft.media[0]?.gateway : null) ||
      nft.rawMetadata?.image ||
      null;

    // Extract attributes and normalize to 'traits' for frontend
    const traits = Array.isArray(nft.rawMetadata?.attributes)
      ? nft.rawMetadata.attributes.map((attr: any) => ({
          trait_type: attr.trait_type || 'Unknown',
          value: attr.value || 'Unknown',
        }))
      : Array.isArray(nft.rawMetadata?.traits)
      ? nft.rawMetadata.traits.map((attr: any) => ({
          trait_type: attr.trait_type || attr.type || 'Unknown',
          value: attr.value || 'Unknown',
        }))
      : [];

    return {
      tokenId: nft.tokenId,
      name: nft.title || `NFT #${nft.tokenId}`,
      imageUrl,
      traits, // Fixed: Use 'traits' instead of 'attributes'
    };
  });


    console.log('Alchemy NFTs Response:', JSON.stringify(response.ownedNfts, null, 2)); // Debug log

    const result: NFTsForOwnerOutput = {
      nfts,
      totalCount: response.totalCount,
      contractAddress: contractAddress as Address,
      timestamp: new Date().toISOString(),
      network: config.chainId === 360 ? 'shape-mainnet' : 'shape-sepolia',
      chainId: config.chainId,
      owner,
    };

    if (tokenId) {
      result.tokenId = tokenId;
    }

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
      message: `Error fetching NFTs: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      timestamp: new Date().toISOString(),
    };

    console.error('getNFTsForOwnerV3 Error:', error); // Debug log

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