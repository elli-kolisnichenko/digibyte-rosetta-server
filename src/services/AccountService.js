/**
 * Copyright (c) 2020 DigiByte Foundation NZ Limited
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const RosettaSDK = require('rosetta-node-sdk');
const Errors = require('../../config/errors');
const config = require('../../config');
const DigiByteIndexer = require('../digibyteIndexer');
const rpc = require('../rpc');

const Types = RosettaSDK.Client;

/* Data API: Account */

/**
* Get an Account Balance
* Get an array of all Account Balances for an Account Identifier and the Block Identifier at which the balance lookup was performed.  Some consumers of account balance data need to know at which block the balance was calculated to reconcile account balance changes.  To get all balances associated with an account, it may be necessary to perform multiple balance requests with unique Account Identifiers.  If the client supports it, passing nil AccountIdentifier metadata to the request should fetch all balances (if applicable).  It is also possible to perform a historical balance lookup (if the server supports it) by passing in an optional BlockIdentifier.
*
* accountBalanceRequest AccountBalanceRequest
* returns AccountBalanceResponse
* */
const balance = async (params) => {
  const { accountBalanceRequest } = params;

  // Get the requested address
  const { address } = accountBalanceRequest.account_identifier;

  // Either block index or block hash
  let atBlock = null;

  // Prepare the block identifier for the response
  const blockIdentifier = new Types.BlockIdentifier();

  if (accountBalanceRequest.block_identifier) {
    if (accountBalanceRequest.block_identifier.hash) {
      atBlock = accountBalanceRequest.block_identifier.hash;
      blockIdentifier.hash = accountBalanceRequest.block_identifier.hash;
    }

    // Prefer block index to block hash
    if (accountBalanceRequest.block_identifier.index) {
      atBlock = accountBalanceRequest.block_identifier.index;
      blockIdentifier.index = accountBalanceRequest.block_identifier.index;
    }
  }

  try {
    // Get the Account Balance from the UTXO Indexer
    const accountData = await DigiByteIndexer.getAccountBalance(address, atBlock);
    const { balance } = accountData;

    // BlockSymbol
    blockIdentifier.index = accountData.blockSymbol;
    if (accountData.blockHash) blockIdentifier.hash = accountData.blockHash;

    // If the hash was not yet set, get the block hash using rpc.
    if (!blockIdentifier.hash) {
      console.log('Retrieving the block hash for symbol', accountData);
      blockIdentifier.hash = await rpc.getblockhash({ height: accountData.blockSymbol });
    }

    // Create the balances array
    const balances = [
      new Types.Amount(
        balance.toFixed(0),
        config.serverConfig.currency,
      ),
    ];

    // Return the account balance
    return new Types.AccountBalanceResponse(
      blockIdentifier,
      balances,
    );

  } catch (e) {
    return Errors.UNABLE_TO_RETRIEVE_BALANCE.addDetails({
      message: e.message,
    });
  }
};

module.exports = {
  /* /account/balance */
  balance,
};
