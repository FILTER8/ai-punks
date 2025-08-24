import { shape } from 'viem/chains';

export const config = {
  chainId: Number(process.env.CHAIN_ID),
  alchemyApiKey: process.env.ALCHEMY_API_KEY as string,
  raribleApiKey: process.env.RARIBLE_API_KEY as string,
  isMainnet: Number(process.env.CHAIN_ID) === 360,
  redisUrl: process.env.REDIS_URL as string,
  defaultRpcUrl:
    Number(process.env.CHAIN_ID) === 360
      ? 'https://mainnet.shape.network'
      : 'https://sepolia.shape.network',
} as const;