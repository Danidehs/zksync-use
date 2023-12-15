// Sets the provider for ZkSync.
async function getZkSyncProvider(zksync, networkName) {
  let zkSyncProvider;
  try {
    zkSyncProvider = await zksync.getDefaultProvider(networkName);
  } catch (error) {
    console.log('Unable to connect to zkSync.');
    console.log(error);
  }
  return zkSyncProvider;
}

// Sets the ethereum provider (whether is mainnet or devnet)
async function getEthereumProvider(ethers, networkName) {
  let ethersProvider;
  try {
    // eslint-disable-next-line new-cap
    ethersProvider = new ethers.getDefaultProvider(networkName);
  } catch (error) {
    console.log('Could not connect to Rinkeby');
    console.log(error);
  }
  return ethersProvider;
}

// Initiate an account for ZkSync (ZkSync wallet is exactly the same as eth wallet)
async function initAccount(rinkebyWallet, zkSyncProvider, zksync) {
  const zkSyncWallet = await zksync.Wallet.fromEthSigner(
    rinkebyWallet,
    zkSyncProvider
  );
  return zkSyncWallet;
}

// Register the recently created account on zkSync
async function registerAccount(wallet) {
  console.log(`Registering the ${wallet.address()} account on zkSync`);

  //Verify a signing key has already been set
  if (!(await wallet.isSigningKeySet())) {
    // Your signing keys have not been set.
    // Next we verify the account exists, if 'undefined' it means does not yet exist
    if ((await wallet.getAccountId()) === undefined) {
      throw new Error('Unknown account');
    }
    // Set signing key
    const changePubkey = await wallet.setSigningKey();
    // Waits the transaction to end
    await changePubkey.awaitReceipt();
  }
  console.log(`Account ${wallet.address()} registered`);
}

// Deposit the amount to ZkSync from ethereum net
async function depositToZkSync(zkSyncWallet, token, amountToDeposit, ethers) {
  const deposit = await zkSyncWallet.depositToSyncFromEthereum({
    depositTo: zkSyncWallet.address(),
    token: token,
    amount: ethers.utils.parseEther(amountToDeposit),
  });
  try {
    await deposit.awaitReceipt();
  } catch (error) {
    console.log('Error while awaiting confirmation from the zkSync operators.');
    console.log(error);
  }
}

// Transfer assets between ethereum and zksync
async function transfer(
  from,
  toAddress,
  amountToTransfer,
  transferFee,
  token,
  zksync,
  ethers
) {
  // On ZkSync transfer amounts should be packable to 5-byte long floating-point representations,
  // and fees paid should be packable to 2-byte long floating-point representations. This can be done with the next two functions
  const closestPackableAmount = zksync.utils.closestPackableTransactionAmount(
    ethers.utils.parseEther(amountToTransfer)
  );
  const closestPackableFee = zksync.utils.closestPackableTransactionFee(
    ethers.utils.parseEther(transferFee)
  );

  // We need to synchronize the transfers between Ethereum and zkSync
  const transfer = await from.syncTransfer({
    to: toAddress,
    token: token,
    amount: closestPackableAmount,
    fee: closestPackableFee,
  });
  // Awaits for the receipt to complete the operation
  const transferReceipt = await transfer.awaitReceipt();
  console.log('Got transfer receipt.');
  console.log(transferReceipt);
}

// Calculates the fee of the transcaction
async function getFee(transactionType, address, token, zkSyncProvider, ethers) {
  const feeInWei = await zkSyncProvider.getTransactionFee(
    transactionType,
    address,
    token
  );
  return ethers.utils.formatEther(feeInWei.totalFee.toString());
}

// Now it withdraw the assets from zkSync to Ethereum
async function withdrawToEthereum(
  wallet,
  amountToWithdraw,
  withdrawalFee,
  token,
  zksync,
  ethers
) {
  const closestPackableAmount = zksync.utils.closestPackableTransactionAmount(
    ethers.utils.parseEther(amountToWithdraw)
  );
  const closestPackableFee = zksync.utils.closestPackableTransactionFee(
    ethers.utils.parseEther(withdrawalFee)
  );
  // We need to synchronize this transaction
  const withdraw = await wallet.withdrawFromSyncToEthereum({
    ethAddress: wallet.address(),
    token: token,
    amount: closestPackableAmount,
    fee: closestPackableFee,
  });
  await withdraw.awaitVerifyReceipt();

  console.log('ZKP verification is complete');
}

// We can retrieve the balances from an account with its state that is a JSON object
async function displayZkSyncBalance(wallet, ethers) {
  // Instantiate the JSON object
  const state = await wallet.getAccountState();

  // If balance is '0' it will return undefined, so we check this to return the correct value
  if (state.committed.balances.ETH) {
    console.log(
      `Commited ETH balance for ${wallet.address()}: ${ethers.utils.formatEther(
        state.committed.balances.ETH
      )}`
    );
    // Here we handle the undefined statement to show 0 (not undefined) if its balance is 0
  } else {
    console.log(`Commited ETH balance for ${wallet.address()}: 0`);
  }
  if (state.verified.balances.ETH) {
    console.log(
      `Verified ETH balance for ${wallet.address()}: ${ethers.utils.formatEther(
        state.verified.balances.ETH
      )}`
    );
  } else {
    console.log(`Verified ETH balance for ${wallet.address()}: 0`);
  }
}

// Export all these variables
module.exports = {
  getZkSyncProvider,
  getEthereumProvider,
  depositToZkSync,
  registerAccount,
  displayZkSyncBalance,
  transfer,
  withdrawToEthereum,
  getFee,
  initAccount,
};
