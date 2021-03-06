import {
    Connection,
    sendAndConfirmRawTransaction,
    sendAndConfirmTransaction,
    Signer,
    Transaction,
    TransactionInstruction,
    PublicKey,
    Keypair,
    SystemProgram,
} from "@solana/web3.js";
import { sendTransaction } from "./connection";
import {
    createWrappedNativeAccount, RawDistribution, TokenAccountInfo, RawRoute, StreamDaoProtocol, closeTokenAccount, getAssociatedTokenAddress, createAssociateTokenAccount
} from '@streamdao/aggregator-sdk/lib/streamdaoprotocol';
import { WRAPPED_SOL_MINT } from "@streamdao/aggregator-sdk/lib/const";



export async function sendSwapTransactions({
    connection,
    wallet,
    setupInstructions,
    swapInstructions,
    cleanupInstructions,
    setupSigners,
    swapSigners,
    cleanupSigners,
}: {
    connection: Connection,
    wallet: any,
    setupInstructions: TransactionInstruction[]
    swapInstructions: TransactionInstruction[]
    cleanupInstructions: TransactionInstruction[]
    setupSigners: Signer[]
    swapSigners: Signer[]
    cleanupSigners: Signer[]
}
) {
    if (setupInstructions.length) {
        console.log('setup tx');
        await sendTransaction(connection, wallet, setupInstructions, setupSigners);
    }

    if (swapInstructions.length) {
        console.log('swap tx');
        await sendTransaction(connection, wallet, swapInstructions, swapSigners);
    }

    if (cleanupInstructions.length) {
        console.log('cleanup tx');
        await sendTransaction(connection, wallet, cleanupInstructions, cleanupSigners);
    }
}

export async function findOrCreateTokenAccount({
    connection,
    owner,
    payer,
    mint,
    instructions,
}: {
    connection: Connection,
    owner: PublicKey,
    payer: PublicKey,
    mint: PublicKey,
    instructions: TransactionInstruction[],
}): Promise<PublicKey> {
    const tokenAddress = await getAssociatedTokenAddress(mint, owner);
    const tokenAccount = await connection.getAccountInfo(tokenAddress);

    if (tokenAccount) {
        return tokenAddress
    }

    const account = await createAssociateTokenAccount({
        mint,
        owner,
        payer,
        instructions,
    })
    return account
}

export async function composeInstructions({
    streamdao,
    connection,
    route,
    walletAddress,
    fromTokenAccount,
    midTokenAccount,
    toTokenAccount,
    setupInstructions,
    setupSigners,
    swapInstructions,
    swapSigners,
    cleanupInstructions,
    cleanupSigners,
    slippage = 0.005,
}: {
    streamdao: StreamDaoProtocol,
    connection: Connection,
    route: RawDistribution,
    walletAddress: PublicKey,
    fromTokenAccount: TokenAccountInfo,
    midTokenAccount?: TokenAccountInfo,
    toTokenAccount: TokenAccountInfo,
    setupInstructions: TransactionInstruction[],
    setupSigners: Signer[],
    swapInstructions: TransactionInstruction[],
    swapSigners: Signer[],
    cleanupInstructions: TransactionInstruction[],
    cleanupSigners: Signer[],
    slippage?: number,
}) {
    if (!route || !route.routes || !route.routes.length) {
        throw new Error('No route found')
    }

    if (!walletAddress) {
        throw new Error('walletAddress is required')
    }

    const { amount_in, source_token_mint, destination_token_mint } = route

    if (!fromTokenAccount || (!fromTokenAccount.mint.equals(WRAPPED_SOL_MINT) && !fromTokenAccount.pubkey)) {
        throw new Error('fromTokenAccount is required')
    }

    if (fromTokenAccount.mint.toBase58() !== source_token_mint.pubkey) {
        throw new Error('fromTokenAccount.mint is different from source_token_mint')
    }

    if (toTokenAccount && toTokenAccount.mint && toTokenAccount.mint.toBase58() !== destination_token_mint.pubkey) {
        throw new Error('toTokenAccount.mint is different from destination_token_mint')
    }

    const feeTokenAccount = streamdao.getFeeTokenAccount(destination_token_mint.pubkey)

    if (!feeTokenAccount) {
        throw new Error('feeTokenAccount is required')
    }

    const cleanInstructions: TransactionInstruction[] = []
    const cleanSigners: Signer[] = []

    const fromMintKey = new PublicKey(source_token_mint.pubkey)
    const toMintKey = new PublicKey(destination_token_mint.pubkey)

    const fromAccount = fromTokenAccount.pubkey
    const toAccount = toTokenAccount.pubkey

    // direct swap (USDC -> STREAM)
    if (route.routes.length === 1) {
        const [routes] = route.routes

        const promises = routes.map(
            async (route: RawRoute) =>
                streamdao.composeDirectSwapInstructions({
                    fromMintKey,
                    toMintKey,
                    fromAccount: fromAccount!,
                    toAccount: toAccount!,
                    feeTokenAccount,
                    walletAddress,
                    instructions: setupInstructions,
                    signers: setupSigners,
                    route,
                    slippage,
                    cleanInstructions,
                    cleanSigners,
                }))

        await Promise.all(promises)

        setupInstructions.concat(cleanInstructions)
        setupSigners.concat(cleanSigners)
    } else if (route.routes.length === 2) {
        const [routes] = route.routes
        const [first] = routes

        const middleMintKey = new PublicKey(first.destination_token_mint.pubkey)

        const middleAccount = midTokenAccount ? midTokenAccount.pubkey : await findOrCreateTokenAccount({
            connection,
            owner: walletAddress,
            payer: walletAddress,
            mint: middleMintKey,
            instructions: setupInstructions,
        })

        const swapInfo = await streamdao.findOrCreateSwapInfo({
            owner: walletAddress,
            instructions: setupInstructions,
            signers: setupSigners
        })

        await streamdao.composeIndirectSwapInstructions({
            swapInfo,
            routes: route.routes,
            fromAccount: fromAccount!,
            toAccount: toAccount!,
            middleAccount,
            fromMintKey,
            toMintKey,
            middleMintKey,
            feeTokenAccount,
            walletAddress,
            slippage,
            instructions1: setupInstructions,
            signers1: setupSigners,
            instructions2: swapInstructions,
            signers2: swapSigners,
            cleanInstructions,
            cleanSigners,
        })

        cleanupInstructions.concat(cleanInstructions)
        cleanupSigners.concat(cleanSigners)
    }
}