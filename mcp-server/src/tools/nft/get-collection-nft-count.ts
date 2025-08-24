import { z } from 'zod';
import { Address, isAddress } from 'viem';
import { alchemy } from '../../clients';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';

interface CollectionNftCountOutput {
  contractAddress: Address;
  timestamp: string;
  totalNfts: number;
  network: 'shape-mainnet';
  chainId: number;
  tokenId?: string;
  nftImageUrl?: string | null;
  imageData?: string | null;
  traits?: { trait_type: string; value: string }[];
}

export const schema = {
  contractAddress: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid contract address',
    })
    .default('0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6')
    .describe('The NFT contract address to get the total minted count for'),
  tokenId: z
    .string()
    .regex(/^\d+$/, { message: 'Token ID must be a positive integer' })
    .optional()
    .describe('The token ID to fetch the NFT image and traits for'),
};

export const metadata = {
  name: 'getCollectionNftCount',
  description: 'Get the total number of NFTs minted in a specific collection on the Shape mainnet and optionally fetch an NFT image and traits by token ID.',
  annotations: {
    title: 'Get Collection NFT Count, Image, and Traits',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'nft-analysis',
    educationalHint: true,
    cacheTTL: 60 * 10, // 10 minutes
  },
};

export default async function getCollectionNftCount({
  contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6',
  tokenId,
}: {
  contractAddress?: string;
  tokenId?: string;
}) {
  const cacheKey = `mcp:collectionNftCount:360:${contractAddress.toLowerCase()}:${tokenId || 'no-token'}`;
  // Temporarily disable caching to ensure fresh data
  // const cached = await getCached(cacheKey);
  // if (cached) {
  //   return JSON.parse(cached);
  // }

  try {
    // Fetch contract metadata for totalSupply
    const metadata = await alchemy.nft.getContractMetadata(contractAddress);
    const totalNfts = metadata.totalSupply ? parseInt(metadata.totalSupply, 10) : 0;

    console.log('Alchemy totalSupply:', metadata.totalSupply); // Debug log

    const result: CollectionNftCountOutput = {
      contractAddress: contractAddress as Address,
      timestamp: new Date().toISOString(),
      totalNfts,
      network: 'shape-mainnet',
      chainId: 360,
    };

    // Fetch NFT image and traits if tokenId is provided
if (tokenId) {
  const nftMetadata = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
  result.tokenId = tokenId;
  result.nftImageUrl = nftMetadata.image?.cachedUrl || nftMetadata.imageUrl || nftMetadata.rawMetadata?.image || null;
  result.imageData = nftMetadata.raw?.image_data || nftMetadata.metadata?.image_data || nftMetadata.rawMetadata?.image_data || null;

  // Log full metadata and specific fields to debug
  console.log('NFT Metadata for tokenId', tokenId, ':', JSON.stringify(nftMetadata, null, 2));
  console.log('nftMetadata.metadata:', JSON.stringify(nftMetadata.metadata, null, 2));
  console.log('nftMetadata.rawMetadata:', JSON.stringify(nftMetadata.rawMetadata, null, 2));
  console.log('nftMetadata.raw:', JSON.stringify(nftMetadata.raw, null, 2));
  console.log('nftMetadata.attributes:', JSON.stringify(nftMetadata.attributes, null, 2));
  console.log('nftMetadata.tokenUri:', JSON.stringify(nftMetadata.tokenUri, null, 2));

  // Check for attributes in all possible locations
const attributes =
  (Array.isArray(nftMetadata.metadata?.attributes) ? nftMetadata.metadata.attributes :
   Array.isArray(nftMetadata.rawMetadata?.attributes) ? nftMetadata.rawMetadata.attributes :
   Array.isArray(nftMetadata.raw?.metadata?.attributes) ? nftMetadata.raw.metadata.attributes :
   Array.isArray(nftMetadata.tokenUri?.metadata?.attributes) ? nftMetadata.tokenUri.metadata.attributes :
   Array.isArray(nftMetadata.attributes) ? nftMetadata.attributes : // <- This is your missing piece
   Array.isArray((nftMetadata as any)?.attributes) ? (nftMetadata as any).attributes : // <- Fallback to root-level
   []) as { trait_type?: string; traitType?: string; type?: string; value?: string }[];

  console.log('Attributes for tokenId', tokenId, ':', JSON.stringify(attributes, null, 2));

  result.traits = attributes.map((attr) => ({
    trait_type: attr.trait_type || attr.traitType || attr.type || 'Unknown',
    value: attr.value || 'N/A',
  }));

  console.log('Result traits for tokenId', tokenId, ':', JSON.stringify(result.traits, null, 2));

  if (!attributes.length) {
    console.log('No attributes found for tokenId', tokenId);
  }
}

    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };

    // Re-enable caching once stable
    // await setCached(cacheKey, JSON.stringify(response), metadata.annotations.cacheTTL);

    return response;
  } catch (error) {
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error fetching NFT data: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      timestamp: new Date().toISOString(),
    };

    console.log('Error in getCollectionNftCount:', error); // Debug log

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