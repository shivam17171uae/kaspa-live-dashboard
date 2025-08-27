// script.js - Final version with Block Details Modal and Full Transaction History Display

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
    // Add a single, efficient event listener to the body for handling dynamic content clicks
    document.body.addEventListener('click', handleBodyClick);


    // --- Start Connections & Initializations ---
    initializeCharts();
    connectWebSocket();
    fetchInitialStats();
    fetchMarketStats(); // Fetch market stats on page load
    setInterval(fetchMarketStats, 60000); // And refresh them every minute
    setInterval(fetchInitialStats, 15000); // Auto-refresh network stats
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

// =============================================================================
//  NEW FEATURE: BLOCK DETAILS MODAL
// =============================================================================

// This function now adds the 'block-link' class and a 'data-hash' attribute
// to the block hash link, allowing our event listener to pick it up.
function addNewBlockToFeed(block, container) {
    const blockElement = document.createElement('div');
    blockElement.className = 'block-item flash';
    const explorerUrl = `https://explorer.kaspa.org/blocks/${block.hash}`;
    
    // UPDATED: Added a container div for the hash and button
    blockElement.innerHTML = `
        <div class="block-hash-container">
            <a href="${explorerUrl}" target="_blank" class="block-hash block-link" data-hash="${block.hash}" title="View details in a modal">
                ${block.hash.substring(0, 16)}...
            </a>
            <button class="copy-btn" data-copy-text="${block.hash}" title="Copy hash">📋</button>
        </div>
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

async function handleBodyClick(event) {
    const copyBtn = event.target.closest('.copy-btn');
    if (copyBtn) {
        event.preventDefault();
        event.stopPropagation();
        
        const textToCopy = copyBtn.dataset.copyText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            // UPDATED: Add a class for visual feedback instead of changing text
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
        return;
    }
    // ... rest of the function is the same ...
    const blockLink = event.target.closest('.block-link');
    if (blockLink) {
        event.preventDefault();
        const blockHash = blockLink.dataset.hash;
        if (blockHash) {
            openBlockDetailsModal(blockHash);
        }
    }

    const modal = document.getElementById('details-modal');
    const closeBtn = event.target.closest('#modal-close-btn');
    if (closeBtn || event.target === modal) {
        modal.classList.remove('active');
    }
}

async function openBlockDetailsModal(hash) {
    const modal = document.getElementById('details-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = '<div class="loader active"></div>'; // Show loader
    modal.classList.add('active');

    try {
        const response = await fetch(`${backendApiUrl}/api/block/${hash}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch block data');
        }
        const data = await response.json();
        
        let transactionsHtml = data.transactions.map(tx => {
            const explorerTxUrl = `https://explorer.kaspa.org/txs/${tx.id}`;
            return `
                <div class="transaction-item">
                    <a href="${explorerTxUrl}" target="_blank" title="View Transaction Details">
                        <span class="tx-id">${tx.id.substring(0, 24)}...</span>
                        <span class="tx-detail">${tx.inputCount} Inputs</span>
                        <span class="tx-detail">${tx.outputCount} Outputs</span>
                    </a>
                </div>
            `;
        }).join('');

        modalBody.innerHTML = `
            <div class="modal-stat"><strong>Hash:</strong> <span>${data.hash}</span></div>
            <div class="modal-stat"><strong>DAA Score:</strong> <span>${Number(data.daaScore).toLocaleString()}</span></div>
            <h3>Transactions (${data.transactions.length})</h3>
            <div class="modal-transactions-list">${transactionsHtml || 'No transactions in this block.'}</div>
        `;
    } catch (error) {
        modalBody.innerHTML = `<div class="error">${error.message}</div>`;
    }
}

function updateLiveStats(blockData) {
    document.getElementById('stat-daa-score').textContent = Number(blockData.daaScore).toLocaleString();
}

// =============================================================================
//  WALLET ADDRESS CHECKER (with Pagination)
// =============================================================================

// NEW: State variables for pagination
let currentWalletAddress = '';
let currentPage = 1;
const TRANSACTIONS_PER_PAGE = 10;

// UPDATED: The original button click now just starts the process on page 1
async function handleGetAddressInfo() {
    const address = document.getElementById('kaspaAddress').value.trim();
    if (!address) {
        document.getElementById('address-results-container').innerHTML = `<div class="error">Please enter a Kaspa address.</div>`;
        return;
    }
    
    // Set the global address and reset to the first page
    currentWalletAddress = address;
    currentPage = 1;
    
    // Fetch the data for the first time
    fetchAddressPage();
}

// NEW: A dedicated function to fetch a specific page of data
async function fetchAddressPage() {
    const loader = document.getElementById('address-loader');
    const resultsContainer = document.getElementById('address-results-container');
    const getBalanceBtn = document.getElementById('getBalanceBtn');
    const paginationControls = document.getElementById('pagination-controls');

    getBalanceBtn.disabled = true;
    getBalanceBtn.textContent = 'Searching...';
    loader.classList.add('active');
    
    // Hide controls while loading to prevent double-clicks
    if(paginationControls) paginationControls.style.visibility = 'hidden';

    // Only clear the whole container on the first page load
    if (currentPage === 1) {
        resultsContainer.innerHTML = `
            <div id="balance-result"></div>
            <div id="explorer-link-container"></div>
            <div id="transactions-container"></div>
            <div id="pagination-controls" class="pagination-controls">
                <button id="prev-page-btn" disabled>&laquo; Previous</button>
                <span id="page-indicator"></span>
                <button id="next-page-btn" disabled>Next &raquo;</button>
            </div>
        `;
    }

    try {
        const offset = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
        const response = await fetch(`${backendApiUrl}/api/address/${currentWalletAddress}?limit=${TRANSACTIONS_PER_PAGE}&offset=${offset}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Backend request failed');
        }
        
        const addressData = await response.json();
        
        // Display balance and explorer link (only needs to be done once)
        if (currentPage === 1) {
            const balanceInKas = Number(addressData.balance) / 100000000;
            const explorerUrl = `https://explorer.kaspa.org/addresses/${currentWalletAddress}`;
            document.getElementById('balance-result').innerHTML = `<div class="success">Balance: ${balanceInKas.toLocaleString(undefined, {maximumFractionDigits: 8})} KAS</div>`;
            document.getElementById('explorer-link-container').innerHTML = `<a href="${explorerUrl}" target="_blank">View on Block Explorer</a>`;
        }
        
        displayTransactions(addressData.transactions, document.getElementById('transactions-container'));
        updatePaginationControls(addressData.totalTransactions);

    } catch (error) {
        console.error('Operation failed:', error);
        resultsContainer.innerHTML = `<div class="error">${error.message || 'Could not retrieve wallet data.'}</div>`;
    } finally {
        loader.classList.remove('active');
        getBalanceBtn.disabled = false;
        getBalanceBtn.textContent = 'Get Address Info';
        document.getElementById('pagination-controls').style.visibility = 'visible';

        // Re-attach event listeners for the new buttons
        document.getElementById('prev-page-btn').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchAddressPage();
            }
        });
        document.getElementById('next-page-btn').addEventListener('click', () => {
            currentPage++;
            fetchAddressPage();
        });
    }
}

// NEW: Function to update the state of pagination buttons and indicator
function updatePaginationControls(totalTransactions) {
    const pageIndicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);
    
    if (totalTransactions > 0) {
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage >= totalPages;
    } else {
        pageIndicator.textContent = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }
}


// This function is now updated to handle incoming, outgoing, and pending transactions
function displayTransactions(transactions, container) {
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<h3>No recent transactions found.</h3>';
        return;
    }

    let transactionsHtml = '<h3>Recent Transactions:</h3>';
    
    transactions.forEach(tx => {
        const transactionHash = tx.id.split(':')[0];
        const amountInKas = Number(tx.amount) / 100000000;
        const explorerTxUrl = `https://explorer.kaspa.org/txs/${transactionHash}`;
        
        const isIncoming = tx.direction === 'INCOMING';
        const directionClass = isIncoming ? 'tx-incoming' : 'tx-outgoing';
        const sign = isIncoming ? '+' : '-';
        const directionText = tx.isConfirmed === false ? 'Pending' : (isIncoming ? 'Received' : 'Sent');

        // UPDATED: Wrapped the ID and button in a div for better styling
        transactionsHtml += `
            <a class="transaction-item-link" href="${explorerTxUrl}" target="_blank" title="View Transaction Details">
                <div class="transaction-item">
                    <div class="tx-id-container">
                        <span class="tx-id">${transactionHash.substring(0, 16)}...</span>
                        <button class="copy-btn" data-copy-text="${transactionHash}" title="Copy TX ID">📋</button>
                    </div>
                    <span class="tx-amount ${directionClass}">${sign}${amountInKas.toLocaleString()} KAS</span>
                    <span class="tx-direction ${directionClass}">${directionText}</span>
                </div>
            </a>`;
    });
    container.innerHTML = transactionsHtml;
}