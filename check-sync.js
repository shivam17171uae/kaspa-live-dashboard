// check-sync.js

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// --- gRPC Client Setup (Copied from server.js) ---
const KASPAD_HOST = 'host.docker.internal:16110';
const PROTO_PATH = path.resolve(__dirname, './messages.proto');
let rpcClient;
try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [__dirname] });
    const kaspad_rpc = grpc.loadPackageDefinition(packageDefinition).protowire;
    rpcClient = new kaspad_rpc.RPC(KASPAD_HOST, grpc.credentials.createInsecure());
} catch (error) {
    console.error('[SyncCheck] Failed to initialize gRPC client:', error);
    process.exit(1);
}

// --- callNode Function (Copied from server.js) ---
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

// --- Main Logic ---
async function checkSync() {
    console.log("Attempting to get Block DAG info...");
    try {
        const dagInfo = await callNode({ getBlockDagInfoRequest: {} });
        console.log("SUCCESS! Current Sync Status:");
        // We use console.log with JSON.stringify for clean, readable output
        console.log(JSON.stringify(dagInfo, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value, 2));
    } catch (error) {
        console.error("\n[SyncCheck] FAILED:", error.message);
        console.error("[SyncCheck] This is normal if the node is still starting up. Please try again in a minute.");
    } finally {
        // Ensure the script exits
        process.exit(0);
    }
}

checkSync();