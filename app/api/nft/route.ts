import { NextRequest } from 'next/server';
// Adjust this import path to where get-shape-nft.ts lives
import getShapeNft from '../../../mcp-server/src/tools/nft/get-shape-nft';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address' }),
        { status: 400 }
      );
    }

    // Call the Shape NFT fetcher directly
    const data = await getShapeNft({ address });

    return Response.json(data);
  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}
