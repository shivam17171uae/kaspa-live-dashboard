// testnode.js - FINAL version with prefix handling on BOTH sides of the comparison.

const fetch = require('node-fetch');

const KASPA_ADDRESS_WITH_PREFIX = 'kaspa:qpzpfwcsqsxhxwup26r55fd0ghqlhyugz8cp6y3wxuddc02vcxtjg75pspnwz';
// This remains correct: our clean, prefix-less address for comparison.
const ADDRESS_FOR_COMPARISON = KASPA_ADDRESS_WITH_PREFIX.replace('kaspa:', '');

async function testTransactionLogic() {
    console.log(`[TEST] Starting final test for address: ${KASPA_ADDRESS_WITH_PREFIX}`);
    
    try {
        const explorerApiUrl = `https://api.kaspa.org/addresses/${KASPA_ADDRESS_WITH_PREFIX}/full-transactions?resolve_previous_outpoints=full`;
        
        console.log(`[TEST] Fetching history from: ${explorerApiUrl}`);
        const response = await fetch(explorerApiUrl);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API responded with status ${response.status}: ${errorBody}`);
        }
        const history = await response.json();
        console.log(`[TEST] Found ${history.length} historical transactions. Now processing...`);
        
        const processedTransactions = history.map(tx => {
            // Check resolved inputs (which do NOT have a prefix)
            const isSender = tx.inputs.some(inp => inp.previous_outpoint_resolved?.script_public_key_address === ADDRESS_FOR_COMPARISON);
            
            let direction = 'UNKNOWN';
            let amount = 0n;

            if (isSender) {
                direction = 'OUTGOING';
                // *** THE FIX: Remove prefix from API output address before comparing ***
                amount = tx.outputs
                    .filter(out => out.script_public_key_address.replace('kaspa:', '') !== ADDRESS_FOR_COMPARISON)
                    .reduce((sum, out) => sum + BigInt(out.amount || 0), 0n);
            } else {
                direction = 'INCOMING';
                 // *** THE FIX: Remove prefix from API output address before comparing ***
                amount = tx.outputs
                    .filter(out => out.script_public_key_address.replace('kaspa:', '') === ADDRESS_FOR_COMPARISON)
                    .reduce((sum, out) => sum + BigInt(out.amount || 0), 0n);
            }
            
            return {
                id: tx.transaction_id,
                direction,
                amount: (Number(amount) / 100000000).toLocaleString('en-US', {maximumFractionDigits: 8}),
            };
        }).filter(tx => parseFloat(tx.amount.replace(/,/g, '')) > 0);
        
        console.log("\n--- PROCESSING COMPLETE ---");
        console.log("Here are the processed transactions:");
        console.table(processedTransactions.slice(0, 20));

    } catch (error) {
        console.error("\n--- AN ERROR OCCURRED ---");
        console.error(error);
    }
}

// Run the test
testTransactionLogic();