// services/kaspa-node.js

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
require('dotenv').config(); // Load environment variables

const KASPAD_HOST = process.env.KASPAD_HOST;
const PROTO_PATH = path.resolve(__dirname, '../messages.proto'); // Note the path change

let rpcClient;
try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [path.resolve(__dirname, '..')] });
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

// Export the function and the client for other services to use
module.exports = { callNode, rpcClient };