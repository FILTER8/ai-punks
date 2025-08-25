// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { nanoid } from 'nanoid';
import { config } from '../../config';

// Define interfaces for the API data (aligned with page.tsx and server tools)
interface CollectionData {
  totalNfts?: number;
  holders?: number;
  network?: string;
  chainId?: number;
  contractAddress?: string;
  timestamp?: string;
  tokenId?: string;
  nftImageUrl?: string | null;
  randomNftImageUrl?: string | null;
  imageData?: string | null;
  traits?: { trait_type: string; value: string }[];
  message?: string;
}

interface OwnerData {
  nfts?: { tokenId: string; name: string; imageUrl?: string | null; traits?: { trait_type: string; value: string }[] }[];
  totalCount?: number;
  contractAddress?: string;
  timestamp?: string;
  network?: string;
  chainId?: number;
  owner?: string;
  message?: string;
}

interface MintData {
  message?: string;
  transaction?: { to: string; data: string; value: string };
  metadata?: { contractAddress: string; functionName: string; recipientAddress: string; chainId: number; explorerUrl: string };
  error?: string;
}

interface TopHolderData {
  uniqueHolders?: number;
  topHolders?: {
    ownerAddress: string;
    balance: number;
    tokenId: string;
    tokenMetadata: {
      nftImageUrl?: string | null;
      imageData?: string | null;
      traits?: { trait_type: string; value: string }[];
    };
  }[];
  contractAddress?: string;
  timestamp?: string;
  network?: string;
  chainId?: number;
  message?: string;
}

interface MintStatusData {
  contractAddress: string;
  status: {
    mintStart: number;
    publicMintPrice: string;
    maxSupply: number;
    totalMinted: number;
    collectorFee: string;
    isRevealed: boolean;
    isFreeMint: boolean;
  };
  currentPhase: number;
  activePhase: {
    phaseType: number;
    startTime: number;
    endTime: number;
    mintPrice: string;
    maxPerAddress: number;
    maxSupply: number;
    mintedInPhase: number;
    allowlistRoot: string;
  };
  timestamp: string;
  message?: string;
}

interface ErrorData {
  error: string;
  message?: string;
}

export const maxDuration = 30;

type MessageContent = string | { type: string; text?: string }[];

function extractTextFromMessageContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((p) => p?.type === 'text' && typeof p?.text === 'string');
    return textPart?.text ?? '';
  }
  return '';
}

// Keyword groups for intent detection
const COLLECTION_KEYWORDS = ['collection stat', 'total nfts', 'stats', 'supply', 'how many', 'medalists'];
const OWNERSHIP_KEYWORDS = ['owned by', 'nfts for', 'wallet', 'show me my collection', 'my nfts', 'my medals'];
const MINT_KEYWORDS = ['mint', 'mint one', 'mint me', 'mint medalist', 'mint nft'];
const TOKEN_KEYWORDS = ['token id', 'show me token', 'details of token', 'id', 'token number'];
const RANDOM_TOKEN_KEYWORDS = ['random medalist', 'random id', 'random token'];
const TOP_HOLDER_KEYWORDS = ['top holder', 'top holders', 'top three holders', 'who holds the most'];
const MINT_STATUS_KEYWORDS = ['mint status', 'minting status', 'can i mint', 'mint phase'];

// Define types for each tool's parameters and return types
interface ToolParams {
  getCollectionAnalytics: { contractAddress: string };
  getCollectionNFTCount: { contractAddress: string; tokenId?: string };
  getNFTsForOwnerV3: { owner: string; contractAddress: string };
  getNFTOwners: { contractAddress: string; topHoldersCount: number };
  getMintStatus: { contractAddress: string };
  mintNFT: { owner: string; quantity: number };
}

interface ToolResult {
  getCollectionAnalytics: { result: { content: { type: string; text: string }[] } };
  getCollectionNFTCount: { result: { content: { type: string; text: string }[] } };
  getNFTsForOwnerV3: { result: { content: { type: string; text: string }[] } };
  getNFTOwners: { result: { content: { type: string; text: string }[] } };
  getMintStatus: { result: { content: { type: string; text: string }[] } };
  mintNFT: { result: { content: { type: string; text: string }[] } };
}

async function callMcpServer<T extends keyof ToolParams>(
  tool: T,
  params: ToolParams[T]
): Promise<ToolResult[T]> {
  console.log(`Calling MCP server with tool: ${tool}, params:`, params);
  try {
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3002/mcp';
    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: nanoid(),
        method: 'tools/call',
        params: {
          name: tool,
          arguments: params,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('MCP server response:', result);

    if (result.error) {
      throw new Error(`MCP server error: ${result.error.message}`);
    }

    return result; // Return the full JSON-RPC response
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Raw Request Body:', JSON.stringify(body, null, 2));

    const { messages = [] }: { messages?: { content: MessageContent }[] } = body;

    console.log('Parsed Request:', { messagesCount: messages.length });

    if (!Array.isArray(messages) || messages.length === 0) {
      console.log('Error: No messages provided');
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          async execute({ writer }) {
            const messageId = nanoid();
            writer.write({ type: 'text-start', id: messageId });
            writer.write({ type: 'text-delta', id: messageId, delta: JSON.stringify({ error: '😅 Oops! Please send a message to get started. Try "Show me collection stats" or "Mint me a Medalist"!' }) });
            writer.write({ type: 'text-end', id: messageId });
          },
        }),
      });
    }

    const last = messages[messages.length - 1];
    const userMessageRaw = extractTextFromMessageContent(last?.content);
    const userMessage = (userMessageRaw || '').toLowerCase();

    console.log('User Message:', userMessage);

    if (!userMessage) {
      console.log('Error: Empty message');
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          async execute({ writer }) {
            const messageId = nanoid();
            writer.write({ type: 'text-start', id: messageId });
            writer.write({ type: 'text-delta', id: messageId, delta: JSON.stringify({ error: '😕 No message? Try asking about "collection stats" or "mint me a Medalist"!' }) });
            writer.write({ type: 'text-end', id: messageId });
          },
        }),
      });
    }

    let apiData: CollectionData | OwnerData | MintData | TopHolderData | MintStatusData | ErrorData;

    // Branch 1: Collection stats
    if (COLLECTION_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing collection stats branch');
      const contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6'; // Hardcoded

      console.log('Calling getCollectionAnalytics with contractAddress:', contractAddress);
      const data = await callMcpServer('getCollectionAnalytics', { contractAddress });

      if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
        try {
          const parsedData = JSON.parse(data.result.content[0].text);
          apiData = {
            contractAddress,
            totalNfts: parsedData.totalSupply ?? 0,
            holders: parsedData.owners ?? 0,
            network: config.isMainnet ? 'shape-mainnet' : 'shape-sepolia',
            chainId: config.chainId,
            timestamp: new Date().toISOString(),
            traits: [], // getCollectionAnalytics doesn't return traits
            message: `🏅 Collection stats for ${parsedData.name || 'Unknown Collection'} (${parsedData.symbol || 'N/A'}) at ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}. Total NFTs: ${parsedData.totalSupply ?? 0}, Unique Holders: ${parsedData.owners ?? 0}.`,
          } as CollectionData;
        } catch (e) {
          console.error('Parse error in getCollectionAnalytics:', e);
          apiData = { error: '😓 Sorry, something went wrong while fetching collection stats. Try again!' };
        }
      } else {
        apiData = { error: '😔 No valid data returned from the collection API. Please try again!' };
      }
    }
    // Branch 2: Collection NFT count with optional tokenId
    else if (TOKEN_KEYWORDS.some((kw) => userMessage.includes(kw)) || RANDOM_TOKEN_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing collection NFT count branch');
      const contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6'; // Hardcoded
      let tokenId: string | undefined;

      const tokenIdMatch = userMessage.match(/token id (\d+)/i);
      if (tokenIdMatch) {
        tokenId = tokenIdMatch[1];
        console.log('Using tokenId from message:', tokenId);
      }

      console.log('Calling getCollectionNFTCount with contractAddress:', contractAddress, 'tokenId:', tokenId);
      const data = await callMcpServer('getCollectionNFTCount', { contractAddress, tokenId });

      if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
        try {
          const parsedData = JSON.parse(data.result.content[0].text) as CollectionData;
          apiData = {
            ...parsedData,
            message: parsedData.message || `🏅 Details for ${tokenId ? `Token ID ${tokenId}` : 'a random Medalist'} in the Medalists collection at ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}.`,
          };
        } catch (e) {
          console.error('Parse error in getCollectionNFTCount:', e);
          apiData = { error: '😓 Sorry, something went wrong while fetching NFT data. Try again!' };
        }
      } else {
        apiData = { error: '😔 No valid data returned from the NFT count API. Please try again!' };
      }
    }
    // Branch 3: Ownership stats
    else if (OWNERSHIP_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing ownership stats branch');
      const contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6'; // Hardcoded
      let owner: string | null = null;

      const addressMatch = userMessageRaw.match(/0x[a-fA-F0-9]{40}/i);
      if (addressMatch) {
        owner = addressMatch[0];
        console.log('Using address from message:', owner);
      } else {
        apiData = { error: '😕 Please provide a valid wallet address to check your collection (e.g., "Show me my collection for 0xYourAddress").' };
      }

      if (owner) {
        console.log('Calling getNFTsForOwnerV3 with owner:', owner, 'contractAddress:', contractAddress);
        const data = await callMcpServer('getNFTsForOwnerV3', { owner, contractAddress });

        if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
          try {
            const parsedData = JSON.parse(data.result.content[0].text) as OwnerData;
            apiData = {
              ...parsedData,
              message: parsedData.message || `🏅 Your Medalists collection for ${owner.slice(0, 6)}...${owner.slice(-4)}: ${parsedData.totalCount || 0} NFTs.`,
            };
          } catch (e) {
            console.error('Parse error in getNFTsForOwnerV3:', e);
            apiData = { error: '😓 Sorry, something went wrong while fetching your collection. Try again!' };
          }
        } else {
          apiData = { error: '😔 No valid data returned from the owner API. Please try again!' };
        }
      }
    }
    // Branch 4: Top holders
    else if (TOP_HOLDER_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing top holders branch');
      const contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6'; // Hardcoded
      let topHoldersCount = 1;

      const countMatch = userMessage.match(/top (\d+) holders/i);
      if (countMatch) {
        topHoldersCount = Math.min(parseInt(countMatch[1], 10), 3); // Max 3 per schema
        console.log('Using topHoldersCount from message:', topHoldersCount);
      }

      console.log('Calling getNFTOwners with contractAddress:', contractAddress, 'topHoldersCount:', topHoldersCount);
      const data = await callMcpServer('getNFTOwners', { contractAddress, topHoldersCount });

      if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
        try {
          const parsedData = JSON.parse(data.result.content[0].text) as TopHolderData;
          apiData = {
            ...parsedData,
            message: `🏆 Top ${topHoldersCount} holder(s) for the Medalists collection at ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}. Unique holders: ${parsedData.uniqueHolders || 0}.`,
          };
        } catch (e) {
          console.error('Parse error in getNFTOwners:', e);
          apiData = { error: '😓 Sorry, something went wrong while fetching top holders. Try again!' };
        }
      } else {
        apiData = { error: '😔 No valid data returned from the top holders API. Please try again!' };
      }
    }
    // Branch 5: Mint status
    else if (MINT_STATUS_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing mint status branch');
      const contractAddress = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6'; // Hardcoded

      console.log('Calling getMintStatus with contractAddress:', contractAddress);
      const data = await callMcpServer('getMintStatus', { contractAddress });

      if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
        try {
          const parsedData = JSON.parse(data.result.content[0].text) as MintStatusData;
          apiData = {
            ...parsedData,
            message: `📊 Mint status for the Medalists collection at ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}. Current phase: ${parsedData.currentPhase === 2 ? 'Public' : 'Other'}. Total minted: ${parsedData.status.totalMinted}/${parsedData.status.maxSupply}.`,
          };
        } catch (e) {
          console.error('Parse error in getMintStatus:', e);
          apiData = { error: '😓 Sorry, something went wrong while fetching mint status. Try again!' };
        }
      } else {
        apiData = { error: '😔 No valid data returned from the mint status API. Please try again!' };
      }
    }
    // Branch 6: Mint NFT
    else if (MINT_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing mint NFT branch');
      let owner: string | null = null;

      const addressMatch = userMessageRaw.match(/0x[a-fA-F0-9]{40}/i);
      if (addressMatch) {
        owner = addressMatch[0];
        console.log('Using address from message for mint:', owner);
      } else {
        console.log('No valid address provided in message for mint');
        apiData = { message: '🎨 Ready to mint a Medalist? Please confirm by clicking the Mint button (0.003 ETH) with your connected wallet!' };
      }

      if (owner) {
        console.log('Calling mintNFT with owner:', owner);
        const data = await callMcpServer('mintNFT', { owner, quantity: 1 });

        if (data?.result?.content?.[0]?.type === 'text' && data.result.content[0].text) {
          try {
            const parsedData = JSON.parse(data.result.content[0].text) as MintData;
            apiData = {
              ...parsedData,
              message: parsedData.message || `🎉 Mint request ready for ${owner.slice(0, 6)}...${owner.slice(-4)}! Click the Mint button to confirm (0.003 ETH).`,
            };
          } catch (e) {
            console.error('Parse error in mintNFT:', e);
            apiData = { error: '😓 Sorry, something went wrong with the minting process. Try again!' };
          }
        } else {
          apiData = { error: '😔 No valid data returned from the mint API. Please try again!' };
        }
      }
    }
    // Branch 7: Default response
    else {
      console.log('Processing default branch');
      apiData = {
        message: `🏅 Yo, welcome to **The Medalists**! This on-chain NFT collection is all about celebrating digital creativity.  
What’s up? Try:  
- 📊 "Collection stats" for total NFTs and holders  
- 🔍 "Show me token id 3" or "Show me a random medalist" for NFT details  
- 🏆 "Who is the top holder" or "Show me top three holders" for top collectors  
- 💼 "Show me my collection for 0xYourWalletAddress" for your NFTs  
- 🎨 "Mint me a Medalist" to grab your own  
- 📈 "Mint status" for minting details`,
      };
    }

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          const messageId = nanoid();
          writer.write({ type: 'text-start', id: messageId });
          writer.write({ type: 'text-delta', id: messageId, delta: JSON.stringify(apiData) });
          writer.write({ type: 'text-end', id: messageId });
        },
      }),
    });
  } catch (err: unknown) {
    console.error('Chat API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown server error';
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          const messageId = nanoid();
          writer.write({ type: 'text-start', id: messageId });
          writer.write({ type: 'text-delta', id: messageId, delta: JSON.stringify({ error: `😓 Uh-oh! Something broke: ${errorMessage}. Try again in a sec!` }) });
          writer.write({ type: 'text-end', id: messageId });
        },
      }),
    });
  }
}