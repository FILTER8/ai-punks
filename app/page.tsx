'use client';

import { useState, useCallback, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { nanoid } from 'nanoid';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message as UiMessage, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from '@/components/ai-elements/prompt-input';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { useAppKitAccount } from '@reown/appkit/react';
import { AppKitButton } from '@reown/appkit/react';

const USER_AVATAR = '/user-avatar.png';
const ASSISTANT_AVATAR = '/assistant-avatar.png';

const MINTBAY_GENERATIVE_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = '0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6';
const MINT_PRICE = BigInt('2600000000000000'); // 0.0026 ETH
const COLLECTOR_FEE = BigInt('400000000000000'); // 0.0004 ETH
const TOTAL_PRICE = MINT_PRICE + COLLECTOR_FEE; // 0.003 ETH
const SHAPESCAN_URL = 'https://shapescan.xyz/tx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  parts: Array<{ type: 'text'; text: string }>;
}

interface CollectionData {
  totalNfts?: number;
  holders?: number;
  network?: string;
  chainId?: number;
  tokenId?: string;
  randomTokenId?: string;
  nftImageUrl?: string | null;
  randomNftImageUrl?: string | null;
  imageData?: string | null;
  traits?: { trait_type: string; value: string }[];
  contractAddress?: string;
  message?: string;
  error?: string;
}

interface OwnerData {
  totalCount?: number;
  network?: string;
  nfts?: { tokenId: string; name: string; imageUrl?: string | null; traits?: { trait_type: string; value: string }[] }[];
  error?: string;
  message?: string;
}

interface MintData {
  tokenId?: number;
  transactionHash?: string;
  error?: string;
  message?: string;
  nftImageUrl?: string | null;
  traits?: { trait_type: string; value: string }[];
  transaction?: { to: string; data: string; value: string };
  metadata?: { contractAddress: string; functionName: string; recipientAddress: string; chainId: number; explorerUrl: string };
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
  error?: string;
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

const getOwnershipMessage = (totalCount: number): string => {
  if (totalCount === 0) {
    return "No NFTs yet! Start collecting The Medalists!";
  } else if (totalCount >= 1 && totalCount <= 4) {
    return "Getting started! Nice to see your first Medalists NFTs!";
  } else if (totalCount >= 5 && totalCount <= 9) {
    return "Nice collection! You're building a solid Medalists portfolio!";
  } else {
    return "You are a whale! Your Medalists collection is impressive!";
  }
};

export default function ChatBotDemo() {
  const [input, setInput] = useState('');
  const [mintRequest, setMintRequest] = useState<{ quantity: number; owner: string; userMessageId: string } | null>(null);
  const [validatedMintMessageId, setValidatedMintMessageId] = useState<string | null>(null);
  const { address: wagmiAddress, isConnected: wagmiIsConnected, chainId } = useAccount();
  const { address: appKitAddress, isConnected: appKitIsConnected } = useAppKitAccount();
  const { writeContract, isPending, error: writeError, data: transactionHash } = useWriteContract();
  const publicClient = usePublicClient();

  useEffect(() => {
    console.log('Wallet State - wagmi:', { address: wagmiAddress, isConnected: wagmiIsConnected, chainId });
    console.log('Wallet State - AppKit:', { address: appKitAddress, isConnected: appKitIsConnected });
  }, [wagmiAddress, wagmiIsConnected, chainId, appKitAddress, appKitIsConnected]);

  const { messages, status, error, sendMessage } = useChat<Message>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onError: (error) => console.error('useChat error:', error),
  });

  const isLoading = status === 'streaming';

  const handleMintConfirm = useCallback(async () => {
    if (!mintRequest || !wagmiIsConnected || !wagmiAddress || chainId !== 360) {
      console.error('Mint failed: Wallet not connected or wrong chain', { wagmiIsConnected, wagmiAddress, chainId });
      setMintRequest(null);
      setValidatedMintMessageId(null);
      await sendMessage({
        id: nanoid(),
        role: 'user',
        content: 'Mint failed: Please connect your wallet to Shape Mainnet (chainId: 360).',
        parts: [],
      });
      return;
    }

    console.log('Initiating client-side mint transaction', { address: wagmiAddress, quantity: mintRequest.quantity, owner: mintRequest.owner });

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: MINTBAY_GENERATIVE_ABI,
      functionName: 'mint',
      args: [mintRequest.quantity],
      value: TOTAL_PRICE,
      account: wagmiAddress,
    });
  }, [mintRequest, wagmiIsConnected, wagmiAddress, chainId, writeContract]);

useEffect(() => {
  if (transactionHash && !isPending && publicClient) {
    console.log('Mint transaction successful:', { transactionHash });
    // Bot sends success message
    sendMessage({
      id: nanoid(),
      role: 'assistant',
      content: JSON.stringify({
        transactionHash,
        message: `🎉 Mint successful! View transaction on ShapeScan: ${SHAPESCAN_URL}/${transactionHash}`,
      }, null, 2),
      parts: [{ type: 'text', text: JSON.stringify({
        transactionHash,
        message: `🎉 Mint successful! View transaction on ShapeScan: ${SHAPESCAN_URL}/${transactionHash}`,
      }, null, 2) }],
    });

    // Bot sends fetching message
    sendMessage({
      id: nanoid(),
      role: 'assistant',
      content: '🎨 Your Medalist is being crafted on the blockchain—hang tight!',
      parts: [{ type: 'text', text: '🎨 Your Medalist is being crafted on the blockchain—hang tight!' }],
    });

    const fetchReceipt = async (attempt = 1, maxAttempts = 10, delayMs = 10000) => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
        console.log('Transaction receipt:', receipt);
        let tokenId = null;
        const transferEvent = receipt.logs.find(log =>
          log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        );
        if (transferEvent && transferEvent.topics[3]) {
          tokenId = parseInt(transferEvent.topics[3], 16);
          console.log('Parsed tokenId from receipt:', tokenId);
        } else {
          console.warn('No Transfer event found, querying totalSupply');
          try {
            const totalSupply = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: MINTBAY_GENERATIVE_ABI,
              functionName: 'totalSupply',
            });
            tokenId = Number(totalSupply);
            console.log('TokenId from totalSupply:', tokenId);
          } catch (supplyError) {
            console.error('Error fetching totalSupply:', supplyError);
            tokenId = 106;
          }
        }

        try {
          // Bot sends message to show the new token with improved wording
          await sendMessage({
            id: nanoid(),
            role: 'assistant',
            content: `🏅 Here's your new Medalist! Let me show you Token ID ${tokenId}.`,
            parts: [{ type: 'text', text: `show me my new token id ${tokenId}` }],
          });
        } catch (error: unknown) {
          console.error('Error triggering show new token id:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          await sendMessage({
            id: nanoid(),
            role: 'assistant',
            content: JSON.stringify({
              tokenId,
              message: `🏅 Your new Medalist (Token ID: ${tokenId}) is here, but I couldn't fetch its metadata: ${errorMessage}`,
            }, null, 2),
            parts: [],
          });
        }
      } catch (error: unknown) {
        if (attempt < maxAttempts) {
          console.log(`Retry attempt ${attempt}/${maxAttempts} for receipt after ${delayMs}ms`);
          setTimeout(() => fetchReceipt(attempt + 1, maxAttempts, delayMs), delayMs);
        } else {
          console.error('Max retries reached, failed to fetch receipt:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          await sendMessage({
            id: nanoid(),
            role: 'assistant',
            content: JSON.stringify({
              transactionHash,
              message: `🎉 Mint successful! View transaction on ShapeScan: ${SHAPESCAN_URL}/${transactionHash}. Failed to fetch token ID: ${errorMessage}`,
            }, null, 2),
            parts: [],
          });
        }
      }
    };

    fetchReceipt();
  }
  if (writeError) {
    console.error('Mint transaction error:', writeError);
    sendMessage({
      id: nanoid(),
      role: 'assistant',
      content: `😓 Mint failed: ${writeError.message}`,
      parts: [],
    });
  }
}, [transactionHash, isPending, writeError, sendMessage, publicClient]);

useEffect(() => {
  if (mintRequest && messages.length > 0) {
    console.log('Checking messages for mint response:', { mintRequest, messageCount: messages.length });
    const userIndex = messages.findIndex(msg => msg.id === mintRequest.userMessageId);
    if (userIndex !== -1 && userIndex + 1 < messages.length) {
      const mintResponse = messages[userIndex + 1];
      if (mintResponse.role === 'assistant') {
        console.log('Mint response found, setting validatedMintMessageId:', mintResponse.id);
        setValidatedMintMessageId(mintResponse.id);
      }
    }
  }
}, [messages, mintRequest]);

const onSubmit = useCallback(
  async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    let messageContent = trimmed;
    const walletAddress = wagmiIsConnected ? wagmiAddress : undefined;
    const isMintCommand =
      trimmed.toLowerCase().includes('mint me 1 token') ||
      trimmed.toLowerCase().includes('mint me 1 nft') ||
      trimmed.toLowerCase().includes('mint me 1 medalist') ||
      trimmed.toLowerCase().includes('mint me a medalist');

    if (isMintCommand) {
      if (!walletAddress) {
        console.error('Mint failed: Wallet not connected', { walletAddress });
        await sendMessage({
          id: nanoid(),
          role: 'user',
          content: 'Mint failed: Please connect your wallet.',
          parts: [],
        });
        return;
      }

      // ✅ Include owner + quantity as structured data in parts
      const messagePayload: Message = {
        role: 'user',
        content: trimmed, // keep the chat nice and clean
        id: nanoid(),
        parts: [
          {
            type: 'text',
            text: JSON.stringify({ owner: walletAddress, quantity: 1 }),
          },
        ],
      };

      console.log('Sending mint request payload with owner:', {
        ...messagePayload,
      });

      setMintRequest({
        quantity: 1,
        owner: walletAddress,
        userMessageId: messagePayload.id,
      });

      await sendMessage(messagePayload);
      return;
    }

    // Auto-append wallet address for collection requests
    if (
      walletAddress &&
      (trimmed.toLowerCase().includes('show me my collection') ||
        trimmed.toLowerCase().includes('my nfts'))
    ) {
      messageContent = `${trimmed} for ${walletAddress}`;
      console.log(
        'Modified collection message with wallet address:',
        messageContent
      );
    }

    const messagePayload: Message = {
      role: 'user',
      content: messageContent,
      id: nanoid(),
      parts: [],
    };
    console.log('Sending message with payload:', messagePayload);

    await sendMessage(messagePayload);

    setInput('');
  },
  [input, sendMessage, wagmiIsConnected, wagmiAddress]
);


return (
  <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
    <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
      🏅 The Medalists are the 🔑 to the AiPunks
    </h1>
    <div className="flex justify-between items-center mb-4">
      <AppKitButton
        balance="hide"
        size="sm"
        label="Connect Wallet"
        className="bg-white-500 text-white px-4 py-2 hover:bg-white-600 disabled:bg-gray-400"
      />
      <p className="text-sm text-gray-600">
        {wagmiIsConnected && wagmiAddress
          ? `Connected: ${wagmiAddress.slice(0, 6)}...${wagmiAddress.slice(-4)}`
          : 'Not Connected'}
      </p>
    </div>
    <Conversation className="flex-1 overflow-auto">
      <ConversationContent className="p-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center">
            GM - Welcome to The Medalists NFTs try 'Mint me a medalist' to get the key to the AiPunks.
          </p>
        )}
        {error && <p className="text-red-500 text-sm text-center">Error: {error.message}</p>}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            } mb-4`}
          >
            <div
              className={`flex items-start max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <img
                src={message.role === 'user' ? USER_AVATAR : ASSISTANT_AVATAR}
                alt={`${message.role} avatar`}
                className="w-10 h-10 rounded-full mr-2 ml-2"
              />
              <UiMessage from={message.role} className="rounded-lg p-3">
                <MessageContent>
                  {message.role === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      <Response>{message.content}</Response>
                    </div>
                  ) : (
                    <>
                      {message.parts?.map((part, i) => {
                        if (part.type === 'text' && part.text) {
                          if (!part.text.startsWith('{') && !part.text.startsWith('[')) {
                            return (
                              <div key={`${message.id}-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
                                <Response>{part.text}</Response>
                              </div>
                            );
                          }
                          try {
                            const data: CollectionData | OwnerData | MintData | TopHolderData | MintStatusData = JSON.parse(part.text || '');
                            console.log(`Parsed data for message ${message.id}-${i}:`, data);
if ('error' in data && data.error) {
  return (
    <div key={`${message.id}-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
      <Response>{data.error}</Response>
    </div>
  );
}
                            if ('message' in data && data.message && !('totalNfts' in data) && !('totalCount' in data) && !('topHolders' in data) && !('tokenId' in data) && !('randomTokenId' in data)) {
                              const content = (
  <div key={`${message.id}-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
    <Response>{data.message}</Response>
  </div>
);
                              return (
                                <>
                                  {content}
                                  {mintRequest && validatedMintMessageId === message.id && (
                                    <div>
                                      <button
                                        onClick={handleMintConfirm}
                                        className="mt-2 bg-green-500 text-white px-16 py-2 text-xm font-semibold hover:bg-green-600 disabled:bg-gray-400"
                                        disabled={isPending}
                                      >
                                        {isPending ? 'Minting...' : 'Mint (0.003 ETH)'}
                                      </button>
                                    </div>
                                  )}
                                </>
                              );
                            }
                            if ('totalNfts' in data && data.totalNfts !== undefined && !('tokenId' in data) && !('randomTokenId' in data)) {
                              return (
                                <div key={`${message.id}-${i}`} className="space-y-2">
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    <Response>{data.message}</Response>
                                  </div>
                                  <p>Total NFTs: {data.totalNfts}</p>
                                  <p>Unique Holders: {data.holders || 'N/A'}</p>
                                  {data.contractAddress && <p>Contract Address: {data.contractAddress}</p>}
                                  <p>Network: {data.network} (Chain ID: {data.chainId})</p>
                                </div>
                              );
                            }
                            if ('totalNfts' in data && ('tokenId' in data || 'randomTokenId' in data)) {
                              return (
                                <div key={`${message.id}-${i}`} className="space-y-2">
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    <Response>{data.message}</Response>
                                  </div>
                                  <p>Total NFTs: {data.totalNfts}</p>
                                  <p>Unique Holders: {data.holders || 'N/A'}</p>
                                  {data.contractAddress && <p>Contract Address: {data.contractAddress}</p>}
                                  <p>Network: {data.network} (Chain ID: {data.chainId})</p>
                                  {(data.randomTokenId || data.tokenId) && (
                                    <p>Token ID: {data.randomTokenId || data.tokenId}</p>
                                  )}
                                  {(data.randomNftImageUrl || data.nftImageUrl || data.imageData) ? (
                                    <div className="w-full aspect-square">
                                      <img
                                        src={data.randomNftImageUrl || data.nftImageUrl || data.imageData || ''}
                                        alt={`Token ${data.randomTokenId || data.tokenId}`}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    </div>
                                  ) : (
                                    <p>No image available.</p>
                                  )}
                                  {(() => {
                                    const traits = data.traits || [];
                                    console.log('Traits in UI for tokenId', data.randomTokenId || data.tokenId, ':', JSON.stringify(traits, null, 2));
                                    return traits.length > 0 ? (
                                      <p>
                                        Traits: {traits.map((t: { trait_type: string; value: string }) => `${t.trait_type}: ${t.value}`).join(', ')}
                                      </p>
                                    ) : (
                                      <p>No traits found.</p>
                                    );
                                  })()}
                                </div>
                              );
                            }
                            if ('totalCount' in data && data.totalCount !== undefined) {
                              return (
                                <div key={`${message.id}-${i}`} className="space-y-4">
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    <Response>{data.message}</Response>
                                  </div>
                                  <p>Network: {data.network}</p>
                                  {data.nfts && data.nfts.length > 0 ? (
                                    <div>
                                      <p>Total NFTs Owned: {data.totalCount}</p>
                                      <p>{getOwnershipMessage(data.totalCount)}</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                        {data.nfts.map((nft) => (
                                          <div
                                            key={nft.tokenId}
                                            className="border rounded-lg p-2 bg-gray-50"
                                          >
                                            {nft.imageUrl ? (
                                              <div className="w-full aspect-square">
                                                <img
                                                  src={nft.imageUrl}
                                                  alt={`NFT ${nft.tokenId}`}
                                                  className="w-full h-full object-cover rounded-lg"
                                                />
                                              </div>
                                            ) : (
                                              <div className="w-full aspect-square bg-gray-200 flex items-center justify-center rounded-lg">
                                                <span className="text-gray-500">No image available</span>
                                              </div>
                                            )}
                                            <p className="mt-2 font-semibold">Token ID {nft.tokenId}</p>
                                            {nft.traits && nft.traits.length > 0 && (
                                              <p>
                                                Traits: {nft.traits.map((t) => `${t.trait_type}: ${t.value}`).join(', ')}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p>No NFTs found.</p>
                                  )}
                                </div>
                              );
                            }
                            if ('topHolders' in data && data.topHolders) {
                              return (
                                <div key={`${message.id}-${i}`} className="space-y-4">
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    <Response>{data.message}</Response>
                                  </div>
                                  <p>Total Unique Holders: {data.uniqueHolders}</p>
                                  {data.topHolders && data.topHolders.length > 0 ? (
                                    <div className="space-y-4">
                                      {data.topHolders.map((holder, index) => (
                                        <div key={holder.ownerAddress} className="border rounded-lg p-2 bg-gray-50">
                                          <p>
                                            Holder {index + 1}: {holder.ownerAddress.slice(0, 6)}...{holder.ownerAddress.slice(-4)}
                                          </p>
                                          <p>Tokens Owned: {holder.balance}</p>
                                          <p>Sample Token ID: {holder.tokenId}</p>
                                          {holder.tokenMetadata.nftImageUrl || holder.tokenMetadata.imageData ? (
                                            <div className="w-full aspect-square">
                                              <img
                                                src={holder.tokenMetadata.nftImageUrl ?? holder.tokenMetadata.imageData ?? ''}
                                                alt={`Token ${holder.tokenId}`}
                                                className="w-full h-full object-cover rounded-lg"
                                              />
                                            </div>
                                          ) : (
                                            <p>No image available.</p>
                                          )}
                                          {holder.tokenMetadata.traits && holder.tokenMetadata.traits.length > 0 ? (
                                            <p>
                                              Traits: {holder.tokenMetadata.traits.map((t) => `${t.trait_type}: ${t.value}`).join(', ')}
                                            </p>
                                          ) : (
                                            <p>No traits found.</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>No top holders found.</p>
                                  )}
                                </div>
                              );
                            }
                            if ('status' in data && 'currentPhase' in data) {
                              return (
                                <div key={`${message.id}-${i}`} className="space-y-2">
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    <Response>{data.message}</Response>
                                  </div>
                                  <p>Contract Address: {data.contractAddress}</p>
                                  <p>Current Phase: {data.currentPhase === 2 ? 'Public' : 'Other'}</p>
                                  <p>Total Minted: {data.status.totalMinted}/{data.status.maxSupply}</p>
                                  <p>Mint Price: {(Number(data.status.publicMintPrice) / 1e18).toFixed(4)} ETH</p>
                                  <p>Collector Fee: {(Number(data.status.collectorFee) / 1e18).toFixed(4)} ETH</p>
                                  <p>Revealed: {data.status.isRevealed ? 'Yes' : 'No'}</p>
                                  <p>Free Mint: {data.status.isFreeMint ? 'Yes' : 'No'}</p>
                                </div>
                              );
                            }
                            const content = (
  <div key={`${message.id}-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
    <Response>{data.message || JSON.stringify(data, null, 2)}</Response>
  </div>
);
                            return (
                              <>
                                {content}
                                {mintRequest && validatedMintMessageId === message.id && (
                                  <div>
                                    <button
                                      onClick={handleMintConfirm}
                                      className="mt-2 bg-green-500 text-white px-16 py-2 text-xm font-semibold hover:bg-green-600 disabled:bg-gray-400"
                                      disabled={isPending}
                                    >
                                      {isPending ? 'Minting...' : 'Mint (0.003 ETH)'}
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          } catch (e) {
                            console.error('JSON parse error in part:', e, 'Text:', part.text);
                            return (
                              <div key={`${message.id}-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
                                <Response>{part.text}</Response>
                              </div>
                            );
                          }
                        }
                        return null;
                      })}
                    </>
                  )}
                </MessageContent>
              </UiMessage>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center">
            <Loader />
          </div>
        )}
      </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput onSubmit={onSubmit} className="mt-4">
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about The Medalists NFTs (e.g., 'Show me my collection', 'Mint me a medalist', 'Show me token id ', 'Show me a random medalist', or 'Who is the top holder')"
          className="border border-gray-300 rounded-lg p-3 w-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <PromptInputToolbar>
          <PromptInputSubmit
            disabled={!input || isLoading}
            status={isLoading ? 'streaming' : undefined}
            className="bg-blue-500 text-white rounded-lg px-4 py-2 disabled:bg-gray-400"
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}