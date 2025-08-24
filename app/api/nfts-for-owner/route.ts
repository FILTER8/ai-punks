import { NextRequest } from 'next/server';
import getNFTsForOwnerV3 from '../../../mcp-server/src/tools/nft/get-nfts-for-owner-v3';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    const tokenId = req.nextUrl.searchParams.get('tokenId') || undefined;

    if (!owner) {
      return new Response(
        JSON.stringify({ error: 'Owner address is required' }),
        { status: 400 }
      );
    }

    console.log('NFTs for Owner API owner:', owner); // Debug log

    const data = await getNFTsForOwnerV3({ owner, tokenId });
    return Response.json(data);
  } catch (error: any) {
    console.error('NFTs for Owner API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}