// script.js - Final version with Market Stats, Live Peers, and Charting

const backendApiUrl = 'http://localhost:3000';
const backendWsUrl = 'ws://localhost:3000';
let tpsBpsChart; // This will hold our chart object

document.addEventListener('DOMContentLoaded', () => {
    // --- Setup Event Listeners ---
    document.getElementById('getBalanceBtn').addEventListener('click', handleGetAddressInfo);
    document.getElementById('kaspaAddress').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('getBalanceBtn').click();
        }
    });

    // --- Start Connections & Initializations ---
    initializeCharts();
    connectWebSocket();
    fetchInitialStats();
    fetchMarketStats(); // Fetch market stats on page load
    setInterval(fetchMarketStats, 60000); // And refresh them every minute
});

// =============================================================================
//  INITIAL DATA FETCHING (for stats panels)
// =============================================================================

async function fetchMarketStats() {
    try {
        const response = await fetch(`${backendApiUrl}/api/market-stats`);
        if (!response.ok) throw new Error('Market stats fetch failed');
        const stats = await response.json();
        
        document.getElementById('stat-price').textContent = `$${stats.price.toLocaleString('en-US', { minimumFractionDigits: 4 })}`;
        
        const priceChangeEl = document.getElementById('stat-price-change');
        priceChangeEl.textContent = `${stats.price_change_24h.toFixed(2)}%`;
        priceChangeEl.className = stats.price_change_24h >= 0 ? 'price-up' : 'price-down';
        
        document.getElementById('stat-market-cap').textContent = `$${Math.round(stats.market_cap / 1_000_000).toLocaleString()}M`;
        document.getElementById('stat-volume').textContent = `$${Math.round(stats.volume_24h / 1_000_000).toLocaleString()}M`;
    } catch (error) {
        console.error("Could not fetch market stats:", error);
    }
}

async function fetchInitialStats() {
    try {
        const response = await fetch(`${backendApiUrl}/api/initial-stats`);
        if (!response.ok) throw new Error('Initial stats fetch failed');
        const stats = await response.json();
        
        document.getElementById('stat-daa-score').textContent = Number(stats.daaScore).toLocaleString();
        document.getElementById('stat-peers').textContent = stats.peerCount;
        
        const networkHashrate = Number(stats.hashrate);
        document.getElementById('stat-hashrate').textContent = `${(networkHashrate / 1_000_000_000_000_000).toFixed(2)} PH/s`;
        
        const circulatingKAS = Number(stats.circulatingSupply) / 100_000_000;
        document.getElementById('stat-supply').textContent = `${(circulatingKAS / 1_000_000_000).toFixed(2)} Billion KAS`;
    } catch (error) {
        console.error("Could not fetch initial stats:", error);
        document.getElementById('stat-daa-score').textContent = 'Error';
        document.getElementById('stat-peers').textContent = 'Error';
        document.getElementById('stat-hashrate').textContent = 'Error';
        document.getElementById('stat-supply').textContent = 'Error';
    }
}

// =============================================================================
//  LIVE WEBSOCKETS AND CHARTING
// =============================================================================

function initializeCharts() {
    const ctx = document.getElementById('tpsBpsChart').getContext('2d');
    tpsBpsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Timestamps
            datasets: [{
                label: 'Blocks Per Second (BPS)',
                data: [],
                borderColor: 'rgba(137, 221, 255, 0.8)', // --header-color
                backgroundColor: 'rgba(137, 221, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }, {
                label: 'Transactions Per Second (TPS)',
                data: [],
                borderColor: 'rgba(255, 158, 100, 0.8)', // --orange
                backgroundColor: 'rgba(255, 158, 100, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#c0caf5' }, grid: { color: '#414868' } },
                y: { beginAtZero: true, ticks: { color: '#c0caf5' }, grid: { color: '#414868' } }
            },
            plugins: { legend: { labels: { color: '#c0caf5' } } }
        }
    });
}

function connectWebSocket() {
    const wsStatus = document.getElementById('ws-status');
    const feedContainer = document.getElementById('block-feed-container');
    const ws = new WebSocket(backendWsUrl);

    ws.onopen = () => {
        console.log('[WebSocket] Connection established!');
        wsStatus.className = 'status-connected';
        wsStatus.title = 'Connected';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_block') {
            addNewBlockToFeed(data, feedContainer);
            updateLiveStats(data);
            updateChart(data);
        }
    };

    ws.onclose = () => {
        console.log('[WebSocket] Connection closed. Reconnecting in 5 seconds...');
        wsStatus.className = 'status-disconnected';
        wsStatus.title = 'Disconnected';
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        ws.close();
    };
}

let blockTimestamps = [];
let transactionCounts = [];

function updateChart(block) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();

    blockTimestamps.push(now);
    transactionCounts.push(block.transactionCount);

    const sixtySecondsAgo = now - 60000;
    while (blockTimestamps.length > 0 && blockTimestamps[0] < sixtySecondsAgo) {
        blockTimestamps.shift();
        transactionCounts.shift();
    }
    
    const durationInSeconds = (blockTimestamps.length > 1) ? (blockTimestamps[blockTimestamps.length - 1] - blockTimestamps[0]) / 1000 : 1;
    const bps = (blockTimestamps.length - 1) / durationInSeconds;
    const tps = transactionCounts.reduce((a, b) => a + b, 0) / durationInSeconds;

    tpsBpsChart.data.labels.push(timestamp);
    tpsBpsChart.data.datasets[0].data.push(bps.toFixed(2));
    tpsBpsChart.data.datasets[1].data.push(tps.toFixed(2));
    
    if (tpsBpsChart.data.labels.length > 20) {
        tpsBpsChart.data.labels.shift();
        tpsBpsChart.data.datasets.forEach(dataset => dataset.data.shift());
    }

    tpsBpsChart.update('none');

    document.getElementById('stat-bps').textContent = bps.toFixed(2);
    document.getElementById('stat-tps').textContent = tps.toFixed(2);
}

function addNewBlockToFeed(block, container) {
    const blockElement = document.createElement('div');
    blockElement.className = 'block-item flash';
    const explorerUrl = `https://explorer.kaspa.org/blocks/${block.hash}`;
    blockElement.innerHTML = `
        <a href="${explorerUrl}" target="_blank" class="block-hash" title="${block.hash}">
            ${block.hash.substring(0, 16)}...
        </a>
        <div class="block-details">
            <span class="block-daa" title="DAA Score">${Number(block.daaScore).toLocaleString()}</span>
            <span class="block-tx-count">${block.transactionCount} Txs</span>
        </div>
    `;
    container.insertBefore(blockElement, container.firstChild);
    while (container.children.length > 30) {
        container.removeChild(container.lastChild);
    }
}

function updateLiveStats(blockData) {
    document.getElementById('stat-daa-score').textContent = Number(blockData.daaScore).toLocaleString();
}

// =============================================================================
//  WALLET ADDRESS CHECKER
// =============================================================================

async function handleGetAddressInfo() {
    const address = document.getElementById('kaspaAddress').value.trim();
    const loader = document.getElementById('address-loader');
    const resultsContainer = document.getElementById('address-results-container');
    const getBalanceBtn = document.getElementById('getBalanceBtn');

    if (!address) {
        resultsContainer.innerHTML = `<div class="error">Please enter a Kaspa address.</div>`;
        return;
    }
    
    getBalanceBtn.disabled = true;
    resultsContainer.innerHTML = '';
    loader.classList.add('active');

    try {
        const response = await fetch(`${backendApiUrl}/api/address-info/${address}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Backend request failed');
        }
        
        const addressData = await response.json();
        
        const balanceInKas = Number(addressData.balance) / 100000000;
        const explorerUrl = `https://explorer.kaspa.org/addresses/${address}`;

        resultsContainer.innerHTML = `
            <div id="balance-result" class="success">Balance: ${balanceInKas.toLocaleString(undefined, {maximumFractionDigits: 8})} KAS</div>
            <div id="explorer-link-container"><a href="${explorerUrl}" target="_blank">View on Block Explorer</a></div>
            <div id="transactions-container"></div>
        `;
        
        displayTransactions(addressData.transactions, document.getElementById('transactions-container'));

    } catch (error) {
        console.error('Operation failed:', error);
        resultsContainer.innerHTML = `<div class="error">${error.message || 'Could not retrieve wallet data.'}</div>`;
    } finally {
        loader.classList.remove('active');
        getBalanceBtn.disabled = false;
    }
}

function displayTransactions(transactions, container) {
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<h3>No recent incoming transactions found.</h3>';
        return;
    }

    let transactionsHtml = '<h3>Recent Incoming Transactions:</h3>';
    const recentTransactions = transactions.slice(0, 5);

    recentTransactions.forEach(tx => {
        const transactionHash = tx.id.split(':')[0];
        const amountInKas = Number(tx.amount) / 100000000;
        const explorerTxUrl = `https://explorer.kaspa.org/txs/${transactionHash}`;
        transactionsHtml += `
            <div class="transaction-item">
                <a href="${explorerTxUrl}" target="_blank" title="View Transaction Details">
                    <span class="tx-id">${transactionHash.substring(0, 16)}...</span>
                    <span class="tx-amount tx-incoming">+${amountInKas.toLocaleString()} KAS</span>
                    <span class="tx-direction tx-incoming">Received</span>
                </a>
            </div>`;
    });
    container.innerHTML = transactionsHtml;
}