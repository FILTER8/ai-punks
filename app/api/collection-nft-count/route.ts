import { NextRequest } from 'next/server';
import getCollectionNftCount from '../../../mcp-server/src/tools/nft/get-collection-nft-count';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const tokenId = req.nextUrl.searchParams.get('tokenId') || undefined;
    const data = await getCollectionNftCount({ tokenId });
    return Response.json(data);
  } catch (error: any) {
    console.error('Collection NFT Count API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}