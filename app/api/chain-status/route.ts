import { NextRequest } from 'next/server';
import getChainStatus from '../../../mcp-server/src/tools/network/get-chain-status';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const data = await getChainStatus();
    return Response.json(data);
  } catch (error: any) {
    console.error('Chain Status API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}