// routes/api.js - CORRECTED

const express = require('express');
const fetch = require('node-fetch');
const { callNode } = require('../services/kaspa-node'); // Import the gRPC helper

// *** THIS IS THE MISSING LINE THAT FIXES THE ERROR ***
const router = express.Router();

// All routes are now attached to the `router` object
router.get('/address/:address', async (req, res) => {
    const address = req.params.address;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    console.log(`[API] Received request for address: ${address} (limit: ${limit}, offset: ${offset})`);

    try {
        const addressWithPrefix = address.startsWith('kaspa:') ? address : `kaspa:${address}`;
        const addressForComparison = addressWithPrefix.replace('kaspa:', '');

        let historicalTransactions = [];
        let totalTransactions = 0;

        try {
            const transactionsApiUrl = `https://api.kaspa.org/addresses/${addressWithPrefix}/full-transactions?resolve_previous_outpoints=full&limit=${limit}&offset=${offset}`;
            const countApiUrl = `https://api.kaspa.org/addresses/${addressWithPrefix}/transactions-count`;

            const [txsResponse, countResponse] = await Promise.all([
                fetch(transactionsApiUrl, { timeout: 15000 }),
                fetch(countApiUrl, { timeout: 10000 })
            ]);

            if (countResponse.ok) {
                const countData = await countResponse.json();
                totalTransactions = countData.total;
            }

            if (!txsResponse.ok) {
                if (txsResponse.status === 404) console.log(`[API] No historical transactions found for this address.`);
                else throw new Error(`Explorer API responded with status ${txsResponse.status}`);
            } else {
                const history = await txsResponse.json();
                console.log(`[API] Found ${history.length} historical transactions for this page.`);
                historicalTransactions = history.map(tx => {
                    const isSender = tx.inputs.some(inp => inp.previous_outpoint_resolved?.script_public_key_address?.replace('kaspa:', '') === addressForComparison);
                    let direction = isSender ? 'OUTGOING' : 'INCOMING';
                    let amount = 0n;
                    if (isSender) {
                        amount = tx.outputs.filter(out => out.script_public_key_address?.replace('kaspa:', '') !== addressForComparison).reduce((sum, out) => sum + BigInt(out.amount || 0), 0n);
                    } else {
                        amount = tx.outputs.filter(out => out.script_public_key_address?.replace('kaspa:', '') === addressForComparison).reduce((sum, out) => sum + BigInt(out.amount || 0), 0n);
                    }
                    return { id: `${tx.transaction_id}:${direction}`, address, amount: amount.toString(), direction, blockDaaScore: (tx.block_daa_score ?? '0').toString(), isConfirmed: true, };
                }).filter(tx => tx.amount !== '0');
            }
        } catch (syncError) {
            console.error(`[API] WARNING: Could not sync full transaction history:`, syncError.message);
        }

        const [balanceResponse, mempoolResponse] = await Promise.all([
            callNode({ getBalanceByAddressRequest: { address: addressWithPrefix } }),
            callNode({ getMempoolEntriesByAddressesRequest: { addresses: [addressWithPrefix], includeOrphanPool: true, filterTransactionPool: true } })
        ]);
        
        let pendingTransactions = [];
        if (mempoolResponse && mempoolResponse.entries) {
            const entry = mempoolResponse.entries.find(e => e.address === addressWithPrefix);
            if (entry) {
               (entry.sending || []).forEach(tx => {
                   const totalAmountSent = tx.transaction.outputs.reduce((sum, output) => sum + BigInt(output.amount), 0n);
                   pendingTransactions.push({ id: tx.transaction.verboseData.transactionId + ':OUT:PENDING', address, amount: totalAmountSent.toString(), direction: 'OUTGOING', blockDaaScore: '0', isConfirmed: false });
               });
               (entry.receiving || []).forEach(tx => {
                   const totalAmountReceived = tx.transaction.outputs.filter(o => o.verboseData.scriptPublicKeyAddress === addressWithPrefix).reduce((sum, output) => sum + BigInt(output.amount), 0n);
                   pendingTransactions.push({ id: tx.transaction.verboseData.transactionId + ':IN:PENDING', address, amount: totalAmountReceived.toString(), direction: 'INCOMING', blockDaaScore: '0', isConfirmed: false });
               });
            }
        }
        
        const allTransactions = [...pendingTransactions, ...historicalTransactions];
        allTransactions.sort((a, b) => {
            if (a.isConfirmed === b.isConfirmed) { return Number(b.blockDaaScore) - Number(a.blockDaaScore); }
            return a.isConfirmed ? 1 : -1;
        });

        res.json({
            balance: balanceResponse.balance,
            transactions: allTransactions,
            totalTransactions: totalTransactions 
        });

    } catch (error) {
        console.error(`[API] CRITICAL ERROR in /api/address:`, error);
        res.status(500).json({ error: 'Failed to get live data from your local node.' });
    }
});

router.get('/market-stats', async (req, res) => {
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

router.get('/initial-stats', async (req, res) => {
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

router.get('/block/:hash', async (req, res) => {
    const hash = req.params.hash;
    console.log(`[API] Received request for block details: ${hash}`);
    try {
        const blockResponse = await callNode({ getBlockRequest: { hash: hash, includeTransactions: true } });
        if (!blockResponse || !blockResponse.block) throw new Error('Block not found');
        const blockDetails = {
            hash: blockResponse.block.verboseData.hash,
            daaScore: blockResponse.block.header.daaScore,
            timestamp: blockResponse.block.header.timestamp,
            transactions: blockResponse.block.transactions.map(tx => ({
                id: tx.verboseData.transactionId,
                inputCount: tx.inputs.length,
                outputCount: tx.outputs.length
            }))
        };
        res.json(blockDetails);
    } catch (error) {
        console.error(`[API] Error in /api/block/:hash:`, error.message);
        res.status(500).json({ error: 'Failed to get block details from node.' });
    }
});

module.exports = router;