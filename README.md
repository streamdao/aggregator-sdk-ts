# StreamDao Aggregator SDK

[![npm version](https://badge.fury.io/js/@onesol%2Fonesol-sdk.svg)](https://badge.fury.io/js/@onesol%2Fonesol-sdk)

StreamDAO Aggregator SDK is designed to be easier to use.

> Getting routes for a given token pair, <br/>
> getting transactions for Stream route, <br />
> signing and executing transactions, <br />
> then it's all done.

<br />

## Usage

### → STEP #0

Install

```typescript
yarn add @streamdao/aggregator-sdk
```

### → STEP #1

Load StreamDAO Protocol Instance

```typescript
import {
  Connection,
} from "@solana/web3.js";

const SOLANA_RPC_ENDPOINT = 'https://mainnet.rpcpool.com'
const connection = new Connection()

const StreamDaoProtocol = new StreamDaoProtocol(connection)
```

### → STEP #2

Get supported token list

```typescript
import {
  TokenInfo
} from '@streamdao/aggregator-sdk'

// export interface TokenInfo {
//   readonly chainId: number;
//   readonly address: string;
//   readonly name: string;
//   readonly decimals: number;
//   readonly symbol: string;
//   readonly logoURI?: string;
//   readonly tags?: string[];
//   readonly extensions?: TokenExtensions;
//   readonly feeAccount?: string
// }

const tokenList: TokenInfo[] = await StreamDaoProtocol.getTokenList()
```

### → STEP #3

Get routes form a given token pair

```typescript
import {
  Distribution
} from '@streamdao/aggregator-sdk'

// interface Distribution {
//   routeType: string,
//   routes: Route[][],
//   destinationTokenMint: {
//     decimals: number,
//     address: string
//   },
//   sourceTokenMint: {
//     decimals: number,
//     address: string
//   },
//   amountIn: number,
//   amountOut: number,
// }

const routes: Distribution[] = await streamdaoProtocol.getRoutes({
  amount: number, // amount of the input token(should be with input token decimal) e.g `10 * 10 ** 6`,
  sourceTokenMintKey: string, // mint address of the input token
  destinationTokenMintKey: string, // mint address of the output token
  size: number, // number of the result
  signal: AbortSignal // [AbortController](https://developer.mozilla.org/zh-CN/docs/Web/API/AbortController) signal, if needed, it can be used to abort the fetch request
})
```

 ### → STEP #4

Get transactions for Stream Aggregator route

```typescript
import { Transaction } from '@solana/web3.js'
import {
  Distribution
} from '@streamdao/aggregator-sdk'

const transactions: Transaction[] = await streamdaoProtocol.getTransactions({
  wallet: PublicKey,
  distribution: Distribution, // Stream distribution from the results of the `getRoutes`
  slippage: number, //default is 0.005
})
```

### → STEP #5

Sign these transactions and execute them to swap.

<br />

## Code in action

[streamdao/aggregator-interface](https://github.com/streamdao/aggregator-interface)
