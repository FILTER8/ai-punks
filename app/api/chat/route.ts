import { NextRequest } from 'next/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { nanoid } from 'nanoid';
import getCollectionNftCount from '../../../mcp-server/src/tools/nft/get-collection-nft-count';
import getNFTsForOwnerV3 from '../../../mcp-server/src/tools/nft/get-nfts-for-owner-v3';
import mintNFT from '../../../mcp-server/src/tools/nft/mintNFT';
import getNFTOwners from '../../../mcp-server/src/tools/nft/get-nft-owners';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Raw Request Body:', JSON.stringify(body, null, 2));

    const { messages = [] }: { messages?: any[] } = body;

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

    let apiData: any = null;

    // Branch 0: Test hello message or greeting
    if (userMessage === 'test hello' || /^(hi|hello|hey|gm|yo)\b/.test(userMessage)) {
      console.log('Processing greeting branch');
      apiData = {
        message: `👋 Yo, welcome to **The Medalists** 🏅! This is a super cool NFT collection celebrating digital wins.  
What do you want to explore? Try:  
- 📊 "Collection stats" for the big picture  
- 🔍 "Show me token id 3" or "Show me a random medalist" for a specific or random NFT  
- 🏆 "Who is the top holder" or "Show me top three holders" for top collectors  
- 🎨 "Mint me a Medalist" to grab one  
- 💼 "Show me my collection for 0x..." to see your stash`,
      };
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
    }

    // Branch 1: Top holder(s)
    if (TOP_HOLDER_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing top holder(s) branch');
      const isTopThree = userMessage.includes('top three') || userMessage.includes('top 3');
      const topHoldersCount = isTopThree ? 3 : 1;

      const holdersData = await getNFTOwners({ contractAddress: '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6', topHoldersCount });
      console.log('Raw data from getNFTOwners:', JSON.stringify(holdersData, null, 2));

      if (holdersData?.content?.[0]?.type === 'text' && holdersData.content[0].text) {
        try {
          apiData = JSON.parse(holdersData.content[0].text);
          apiData.message = isTopThree
            ? `🏆 Here are the top three holders of The Medalists collection!`
            : `🏆 Here's the top holder of The Medalists collection!`;
        } catch (e) {
          console.error('Parse error in getNFTOwners:', e);
          apiData = { error: '😓 Sorry, something went wrong while fetching top holders. Try again soon!' };
        }
      } else {
        apiData = { error: '😔 No valid data returned from the owners API. Give it another go!' };
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
    }

    // Branch 2: Collection stats or token (including random token)
    if (
      COLLECTION_KEYWORDS.some((kw) => userMessage.includes(kw)) ||
      TOKEN_KEYWORDS.some((kw) => userMessage.includes(kw)) ||
      RANDOM_TOKEN_KEYWORDS.some((kw) => userMessage.includes(kw))
    ) {
      console.log('Processing collection stats or token branch');
      const tokenIdMatch = userMessageRaw.match(/(?:token\s*id|id|#|token number)\s*(\d+)/i);
      let tokenId = tokenIdMatch ? tokenIdMatch[1] : undefined;
      const isRandomRequest = RANDOM_TOKEN_KEYWORDS.some((kw) => userMessage.includes(kw));

      if (tokenId && isNaN(Number(tokenId))) {
        apiData = { error: '😕 That token ID doesn’t look right. Try something like "Show me token id 3".' };
      } else {
        // Fetch collection stats
        const collectionData = await getCollectionNftCount({ tokenId });
        console.log('Raw data from getCollectionNftCount:', JSON.stringify(collectionData, null, 2));

        if (collectionData?.content?.[0]?.type === 'text' && collectionData.content[0].text) {
          try {
            apiData = JSON.parse(collectionData.content[0].text);

            // Fetch holders count
            const holdersData = await getNFTOwners({ contractAddress: apiData.contractAddress });
            console.log('Raw data from getNFTOwners:', JSON.stringify(holdersData, null, 2));
            const holdersCount = holdersData?.content?.[0]?.type === 'text' && holdersData.content[0].text
              ? JSON.parse(holdersData.content[0].text).uniqueHolders || 0
              : 0;

            // For collection stats or random token, select a random minted token ID
            if (!tokenId || isRandomRequest) {
              const totalNfts = apiData?.totalNfts || 0;
              if (totalNfts > 0) {
                const randomTokenId = Math.floor(Math.random() * totalNfts) + 1;
                console.log('Selected random token ID:', randomTokenId);
                const metadata = await getCollectionNftCount({ tokenId: randomTokenId.toString() });
                console.log('Raw metadata for random token:', JSON.stringify(metadata, null, 2));
                if (metadata?.content?.[0]?.type === 'text' && metadata.content[0].text) {
                  const metadataParsed = JSON.parse(metadata.content[0].text);
                  apiData.randomTokenId = randomTokenId;
                  apiData.randomNftImageUrl = metadataParsed.nftImageUrl || metadataParsed.imageData || null;
                  apiData.traits = metadataParsed.traits || [];
                }
              }
            }

            // Set message based on request type
            apiData.holders = holdersCount;
            apiData.message = tokenId
              ? `🔍 Here’s the scoop on Medalist **#${tokenId}**! 🏅`
              : isRandomRequest
              ? `🔍 Check out a random Medalist **#${apiData.randomTokenId || 'N/A'}**! 🏅`
              : `📊 The Medalists collection has **${apiData?.totalNfts || 'N/A'} NFTs** minted by **${holdersCount} unique holders** on **${apiData?.network || 'Shape'}**. Here's a random Medalist **#${apiData.randomTokenId || 'N/A'}**!`;

          } catch (e) {
            console.error('Parse error in getCollectionNftCount or getNFTOwners:', e);
            apiData = { error: '😓 Sorry, something went wrong while fetching the data. Try again soon!' };
          }
        } else {
          apiData = { error: '😔 No valid data returned from the collection API. Give it another go!' };
        }
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
    }

    // Branch 3: NFTs for owner (including "show me my collection")
    else if (OWNERSHIP_KEYWORDS.some((kw) => userMessage.includes(kw))) {
      console.log('Processing NFTs for owner branch');
      let owner: string | null = null;

      const addressMatch = userMessageRaw.match(/0x[a-fA-F0-9]{40}/i);
      if (addressMatch) {
        owner = addressMatch[0];
        console.log('Using address from message:', owner);
      } else {
        console.log('No valid address provided in message');
        apiData = {
          error: '😉 I need a wallet address to check your collection! Try "Show me my collection for 0x..." or connect your wallet.',
        };
      }

      if (owner) {
        console.log('Calling getNFTsForOwnerV3 with owner:', owner);
        const data = await getNFTsForOwnerV3({ owner });
        console.log('Raw data from getNFTsForOwnerV3:', JSON.stringify(data, null, 2));

        if (data?.content?.[0]?.type === 'text' && data.content[0].text) {
          try {
            apiData = JSON.parse(data.content[0].text);
            apiData.message = apiData.totalCount > 0
              ? `💼 Awesome! **${owner.slice(0, 6)}...${owner.slice(-4)}** owns **${apiData.totalCount} Medalists**. Check them out below!`
              : `💼 Looks like **${owner.slice(0, 6)}...${owner.slice(-4)}** hasn’t snagged any Medalists yet. Time to mint one? 🎨`;
          } catch (e) {
            console.error('Parse error in getNFTsForOwnerV3:', e);
            apiData = { error: '😓 Sorry, something went wrong while fetching your collection. Try again soon!' };
          }
        } else {
          apiData = { error: '😔 No valid data returned from the owner API. Please try again!' };
        }
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
    }

    // Branch 4: Mint NFT
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
        const data = await mintNFT({ owner });
        console.log('Raw data from mintNFT:', JSON.stringify(data, null, 2));

        if (data?.content?.[0]?.type === 'text' && data.content[0].text) {
          try {
            apiData = JSON.parse(data.content[0].text);
            apiData.message = `🎉 Mint request ready for **${owner.slice(0, 6)}...${owner.slice(-4)}**! Click the Mint button to confirm (0.003 ETH).`;
          } catch (e) {
            console.error('Parse error in mintNFT:', e);
            apiData = { error: '😓 Sorry, something went wrong with the minting process. Try again!' };
          }
        } else {
          apiData = { error: '😔 No valid data returned from the mint API. Please try again!' };
        }
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
    }

    // Branch 5: Default response
    else {
      console.log('Processing default branch');
      apiData = {
        message: `🏅 Yo, welcome to **The Medalists**! This on-chain NFT collection is all about celebrating digital creativity.  
What’s up? Try:  
- 📊 "Collection stats" to see how many NFTs are out there  
- 🔍 "Show me token id 3" or "Show me a random medalist" to check a specific or random Medalist  
- 🏆 "Who is the top holder" or "Show me top three holders" for top collectors  
- 💼 "Show me my collection for 0xYourWalletAddress" to view your NFTs  
- 🎨 "Mint me a Medalist" to grab your own`,
      };

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
    }
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