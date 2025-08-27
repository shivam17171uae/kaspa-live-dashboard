// server.js - Main Entry Point

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { initializeWebSocket } = require('./services/websocket');
const apiRoutes = require('./routes/api');

// --- Configuration & Setup ---
const PORT = 3000;
const app = express();
app.use(cors());
BigInt.prototype.toJSON = function() { return this.toString(); };

// --- Use API Routes ---
// Any request starting with /api will be handled by our router
app.use('/api', apiRoutes);

// --- Server and WebSocket Setup ---
const server = http.createServer(app);

// Initialize the WebSocket server and pass it the HTTP server
initializeWebSocket(server);

// --- Start the Server ---
server.listen(PORT, () => {
    console.log(`[API & WebSocket] Server running at http://localhost:${PORT}`);
    // The gRPC ready check is handled implicitly by the services now.
});