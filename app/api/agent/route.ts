import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { experimental_createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const runtime = 'nodejs'; // ✅ Switch to Node.js runtime

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    const mcpUrl = process.env.MCP_SERVER_URL || 'http://127.0.0.1:3002/mcp';

    const mcpClient = await experimental_createMCPClient({
      transport: new StreamableHTTPClientTransport(mcpUrl),
    });

    const tools = await mcpClient.tools();

    const result = await streamText({
      model: openai('gpt-4o'),
      tools,
      system: 'You are an assistant that queries Shape Network for NFTs.',
      messages: [
        {
          role: 'user',
          content: `Use getShapeNft to list NFTs for wallet address ${address}.`,
        },
      ],
      maxSteps: 1,
      onFinish: async () => {
        await mcpClient.close();
      },
    });

    return result.toAIStreamResponse();
  } catch (error: any) {
    console.error('Error in API route:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500 }
    );
  }
}
