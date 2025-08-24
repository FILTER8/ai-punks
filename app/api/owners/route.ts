import { NextRequest } from 'next/server';
import getNFTOwners from '../../../mcp-server/src/tools/nft/get-nft-owners';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const contractAddress = req.nextUrl.searchParams.get('contractAddress') || '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6';
    const topHoldersCount = req.nextUrl.searchParams.get('topHoldersCount')
      ? parseInt(req.nextUrl.searchParams.get('topHoldersCount')!)
      : 1;

    console.log('NFT Owners API contractAddress:', contractAddress, 'topHoldersCount:', topHoldersCount);

    const data = await getNFTOwners({ contractAddress, topHoldersCount });
    return Response.json(data);
  } catch (error: any) {
    console.error('NFT Owners API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}