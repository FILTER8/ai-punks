import { Alchemy, Network } from 'alchemy-sdk';
import { createPublicClient, http } from 'viem';
import { mainnet, shape, shapeSepolia } from 'viem/chains';
import { Redis } from 'ioredis';
import { config } from './config';

export const alchemy = new Alchemy({
  apiKey: config.alchemyApiKey,
  network: config.chainId === 360 ? Network.SHAPE_MAINNET : config.chainId === 11011 ? Network.SHAPE_SEPOLIA : (() => { throw new Error(`Invalid chainId: ${config.chainId}`); })(),
});

export function rpcClient() {
  const chain = config.chainId === 360 ? { ...shape, id: 360 } : config.chainId === 11011 ? { ...shapeSepolia, id: 11011 } : (() => { throw new Error(`Invalid chainId: ${config.chainId}`); })();
  const rootUrl = config.chainId === 360 ? 'shape-mainnet' : 'shape-sepolia';

  const rpcUrl = config.alchemyApiKey
    ? `https://${rootUrl}.g.alchemy.com/v2/${config.alchemyApiKey}`
    : config.defaultRpcUrl;

  console.log('rpcClient URL:', rpcUrl, 'chainId:', config.chainId); // Debug log

  return createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 3, timeout: 10000 }),
    batch: {
      multicall: true,
    },
  });
}

export function mainnetRpcClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(),
  });
}

export const redis = new Redis(config.redisUrl || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 3,
  keepAlive: 3000,
  lazyConnect: true,
  reconnectOnError: (err) => {
    console.error('Redis Connection Error:', err.message);
    return false;
  },
  tls: config.redisUrl && config.redisUrl.startsWith('rediss://') ? {} : undefined,
});

redis.on('connect', () => console.log('Redis Connected Successfully'));
redis.on('error', (err) => console.error('Redis Client Error:', err.message));