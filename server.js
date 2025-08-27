// server.js - FINAL CORRECTED VERSION

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const fetch = require('node-fetch');

// --- Configuration & Setup ---
const PORT = 3000;
const KASPAD_HOST = 'host.docker.internal:16110';
const PROTO_PATH = path.resolve(__dirname, './messages.proto');
const prisma = new PrismaClient();
const app = express();
app.use(cors());
BigInt.prototype.toJSON = function() { return this.toString(); };

// --- gRPC Client Setup ---
let rpcClient;
try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [__dirname] });
    const kaspad_rpc = grpc.loadPackageDefinition(packageDefinition).protowire;
    rpcClient = new kaspad_rpc.RPC(KASPAD_HOST, grpc.credentials.createInsecure());
    console.log('[gRPC] Client for kaspad.exe initialized successfully.');
} catch (error) {
    console.error('[gRPC] Failed to initialize gRPC client:', error);
    process.exit(1);
}

let requestId = 1;
function callNode(requestPayload) {
    return new Promise((resolve, reject) => {
        const stream = rpcClient.MessageStream();
        let responseReceived = false;
        const requestName = Object.keys(requestPayload)[0];
        const expectedResponsePayload = requestName.replace('Request', 'Response');
        stream.on('data', (response) => {
            // Check for an error payload from the gRPC server
            if (response[expectedResponsePayload] && response[expectedResponsePayload].error) {
                return reject(new Error(response[expectedResponsePayload].error.message));
            }
            if (response.payload === expectedResponsePayload) {
                responseReceived = true;
                resolve(response[expectedResponsePayload]);
                stream.end();
            }
        });
        stream.on('error', (err) => reject(err));
        stream.on('end', () => { if (!responseReceived) { reject(new Error(`Stream ended without receiving ${expectedResponsePayload}.`)); } });
        const finalRequest = { id: requestId++, ...requestPayload };
        stream.write(finalRequest);
    });
}
function processUtxosIntoTransactions(utxos) {
    const groupedTransactions = new Map();
    for (const entry of utxos) {
        const txId = entry.outpoint.transactionId;
        const amount = BigInt(entry.utxoEntry.amount);
        const daaScore = BigInt(entry.utxoEntry.blockDaaScore);
        if (groupedTransactions.has(txId)) {
            groupedTransactions.get(txId).totalAmount += amount;
        } else {
            groupedTransactions.set(txId, { transactionId: txId, totalAmount: amount, blockDaaScore: daaScore });
        }
    }
    const processedList = Array.from(groupedTransactions.values());
    processedList.sort((a, b) => Number(b.blockDaaScore - a.b.blockDaaScore));
    return processedList.map(tx => ({ ...tx, id: `${tx.transactionId}:IN`, direction: 'INCOMING', amount: tx.totalAmount.toString(), blockDaaScore: tx.blockDaaScore.toString() }));
}

// =============================================================================
//  API ENDPOINTS
// =============================================================================

app.get('/api/market-stats', async (req, res) => {
    try {
        console.log('[API] Fetching market stats from CoinGecko...');
        const coingeckoUrl = 'https://api.coingecko.com/api/v3/coins/kaspa';
        const response = await fetch(coingeckoUrl);
        if (!response.ok) throw new Error('Failed to fetch from CoinGecko');
        const data = await response.json();
        res.json({
            price: data.market_data.current_price.usd,
            price_change_24h: data.market_data.price_change_percentage_24h,
            volume_24h: data.market_data.total_volume.usd,
            market_cap: data.market_data.market_cap.usd,
        });
    } catch (error) {
        console.error(`[API] Error in /api/market-stats:`, error.message);
        res.status(500).json({ error: 'Failed to get market stats.' });
    }
});

app.get('/api/initial-stats', async (req, res) => {
    try {
        console.log(`[API] Fetching initial network stats...`);
        const [dagInfo, hashrate, coinSupply, peerInfo] = await Promise.all([
            callNode({ getBlockDagInfoRequest: {} }),
            callNode({ estimateNetworkHashesPerSecondRequest: { windowSize: 1000 } }),
            callNode({ getCoinSupplyRequest: {} }),
            callNode({ getConnectedPeerInfoRequest: {} })
        ]);
        res.json({
            daaScore: dagInfo.virtualDaaScore,
            hashrate: hashrate.networkHashesPerSecond,
            circulatingSupply: coinSupply.circulatingSompi,
            peerCount: peerInfo.infos ? peerInfo.infos.length : 0
        });
    } catch (error) {
        console.error(`[API] Error in /api/initial-stats:`, error.message);
        res.status(500).json({ error: 'Failed to get initial stats.' });
    }
});

app.get('/api/address-info/:address', async (req, res) => {
    const address = req.params.address;
    console.log(`[API] Received request for address: ${address}`);
    try {
        const dbTransactions = await prisma.transaction.findMany({ where: { address }, orderBy: { blockDaaScore: 'desc' }, take: 20 });
        if (dbTransactions.length > 0) {
            console.log(`[API] Found ${dbTransactions.length} transactions in DB.`);
            const liveBalance = await callNode({ getBalanceByAddressRequest: { address } });
            res.json({ balance: liveBalance.balance, transactions: dbTransactions });
        } else {
            console.log(`[API] Address not in DB. Performing live lookup...`);
            const [balanceResponse, utxosResponse] = await Promise.all([
                callNode({ getBalanceByAddressRequest: { address } }),
                callNode({ getUtxosByAddressesRequest: { addresses: [address] } })
            ]);
            const transactions = processUtxosIntoTransactions(utxosResponse.entries || []);
            res.json({ balance: balanceResponse.balance, transactions });
        }
    } catch (error) {
        // =========================================================================
        //  START OF THE FIX: Improved error logging
        // =========================================================================
        console.error(`[API] FULL ERROR in /api/address-info:`, error);
        // We can even send the specific error message to the frontend
        res.status(500).json({ error: error.message || 'Failed to get address info from node.' });
        // =========================================================================
        //  END OF THE FIX
        // =========================================================================
    }
});


// --- Server and WebSocket Setup ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
    console.log('[WebSocket] Client connected!');
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected!' }));
    ws.on('close', () => console.log('[WebSocket] Client disconnected.'));
});

function broadcast(data) {
    const jsonData = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(jsonData);
        }
    });
}

function startGrpcNotificationListener() {
    console.log('[gRPC Listener] Opening persistent stream for new blocks...');
    const stream = rpcClient.MessageStream();
    stream.on('data', (response) => {
        if (response.payload === 'blockAddedNotification') {
            const block = response.blockAddedNotification.block;
            broadcast({
                type: 'new_block',
                hash: block.verboseData.hash,
                transactionCount: block.transactions.length,
                daaScore: block.header.daaScore
            });
        }
    });
    stream.on('error', (err) => {
        console.error('[gRPC Listener] Stream error:', err.message, '- Reconnecting in 10s.');
        setTimeout(startGrpcNotificationListener, 10000);
    });
    stream.on('end', () => {
        console.log('[gRPC Listener] Stream ended. Reconnecting in 10s.');
        setTimeout(startGrpcNotificationListener, 10000);
    });
    stream.write({ id: requestId++, notifyBlockAddedRequest: {} });
}

server.listen(PORT, () => {
    console.log(`[API & WebSocket] Server running at http://localhost:${PORT}`);
    rpcClient.waitForReady(new Date().getTime() + 5000, (error) => {
        if (error) { console.error('[gRPC] Client connection check failed:', error); }
        else { console.log('[gRPC] Client ready. Starting listener.'); startGrpcNotificationListener(); }
    });
});