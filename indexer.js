// indexer.js - Corrected full version with reconnection logic

const { PrismaClient } = require('@prisma/client');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const prisma = new PrismaClient();

// --- gRPC Configuration ---
const KASPAD_HOST = 'host.docker.internal:16110';
const PROTO_PATH = path.resolve(__dirname, './messages.proto');

let rpcClient;
try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [__dirname]
    });
    const kaspad_rpc = grpc.loadPackageDefinition(packageDefinition).protowire;
    rpcClient = new kaspad_rpc.RPC(KASPAD_HOST, grpc.credentials.createInsecure());
    console.log('[Indexer] gRPC client initialized.');
} catch (error) {
    console.error('[Indexer] Failed to initialize gRPC client:', error);
    process.exit(1);
}

let requestId = 1;

async function main() {
    console.log('[Indexer] Opening stream to listen for new blocks...');
    const stream = rpcClient.MessageStream();

    stream.on('data', async (response) => {
        if (response.payload === 'blockAddedNotification') {
            const block = response.blockAddedNotification.block;
            console.log(`[Indexer] New Block Received! Hash: ${block.verboseData.hash}, Transactions: ${block.transactions.length}`);

            for (const tx of block.transactions) {
                // --- Process Outputs (Incoming Transactions) ---
                // We use a for loop with an index to get the output's position
                for (let i = 0; i < tx.outputs.length; i++) {
                    const output = tx.outputs[i];
                    const address = output.verboseData.scriptPublicKeyAddress;
                    
                    // We only care about transactions to actual addresses
                    if (address) {
                        // --- Add the output index 'i' to the ID to make it unique ---
                        const uniqueId = `${tx.verboseData.transactionId}:${i}:IN`;

                        await prisma.transaction.create({
                            data: {
                                id: uniqueId,
                                address: address,
                                amount: BigInt(output.amount),
                                direction: 'INCOMING',
                                blockDaaScore: BigInt(block.header.daaScore),
                            }
                        }).catch(e => {
                            // We can ignore unique constraint errors if the indexer restarts, but log others
                            if (e.code !== 'P2002') {
                                console.error(`Error saving incoming tx: ${e.message}`);
                            }
                        });
                    }
                }
                // (Outgoing transaction logic would go here in a full implementation)
            }
        }
    });

    // =========================================================================
    //  START OF THE FIX: Reconnection logic
    // =========================================================================
    stream.on('error', (err) => {
        console.error('[Indexer] Stream Error:', err.message, '- Reconnecting in 10s.');
        // Don't exit. Clean up and try again after a delay.
        stream.end();
        setTimeout(main, 10000); 
    });

    stream.on('end', () => {
        console.log('[Indexer] Stream ended. Reconnecting in 10s.');
        // Don't exit. The stream ended, so let's start a new one.
        setTimeout(main, 10000);
    });
    // =========================================================================
    //  END OF THE FIX
    // =========================================================================

    stream.write({
        id: requestId++,
        notifyBlockAddedRequest: {}
    });
}

// Initial connection check
rpcClient.waitForReady(new Date().getTime() + 5000, (error) => {
    if (error) {
        console.error('[Indexer] Client connection error:', error);
        // If the initial connection fails, we'll let Docker restart it, 
        // but the internal retry logic will handle subsequent failures.
        process.exit(1); 
    }
    console.log('[Indexer] Client is ready. Starting main logic.');
    main(); // Start the main listening loop
});