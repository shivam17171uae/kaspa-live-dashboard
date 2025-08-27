// services/websocket.js

const { WebSocketServer } = require('ws');
const { rpcClient } = require('./kaspa-node'); // Import the rpcClient

let wss;

function initializeWebSocket(server) {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', ws => {
        console.log('[WebSocket] Client connected!');
        ws.send(JSON.stringify({ type: 'welcome', message: 'Connected!' }));
        ws.on('close', () => console.log('[WebSocket] Client disconnected.'));
    });

    // Once the WebSocket server is ready, start listening for new blocks.
    startGrpcNotificationListener();
}

function broadcast(data) {
    if (!wss) return;
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
    // A unique ID is still good practice for requests.
    stream.write({ id: Math.floor(Math.random() * 1000), notifyBlockAddedRequest: {} });
}

module.exports = { initializeWebSocket };