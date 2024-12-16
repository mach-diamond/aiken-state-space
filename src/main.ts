import 'dotenv/config';
import datum from "./data/datum.json" assert { type: "json" };
import { Command, Option } from '@commander-js/extra-typings';
import {initialize, update_state} from './actions';
import { Lucid, Blockfrost, Kupmios, PROTOCOL_PARAMETERS_DEFAULT, generateSeedPhrase, scriptFromNative, paymentCredentialOf, unixTimeToSlot, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config()

const VERBOSE = true
const WALLET_DIR = 'wallets'

// Ensure wallet directory exists
if (!fs.existsSync(WALLET_DIR)) {
  console.log('Creating wallet directory...')
  fs.mkdirSync(WALLET_DIR);
}

// Config: Option Flags --------------------------------------------------------
const previewOption = new Option('-p, --preview', 'Use testnet').default(true);
const addressOption = new Option('-a, --address <address>', 'Contract Address')
  .makeOptionMandatory();
const amountOption = new Option('-m, --amount <amount>', 'Amount to pay in lovelace')
  .argParser(parseInt)
  .makeOptionMandatory();
const datumOption = new Option('-d, --datum <path>', 'Path to datum.json file');
const walletOption = new Option('-w, --wallet <name>', 'Wallet to use')
  .makeOptionMandatory();

// Wallet management functions
const generateWallet = async (name: string) => {
  const seed = generateSeedPhrase();
  const walletPath = `${WALLET_DIR}/${name}.json`;
  
  if (fs.existsSync(walletPath)) {
    throw new Error(`Wallet ${name} already exists`);
  }
  
  fs.writeFileSync(walletPath, JSON.stringify({ seed }));
  return seed;
}

const loadWallet = async (API: any, name: string) => {
  const walletPath = `${WALLET_DIR}/${name}.json`;
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet ${name} not found`);
  }
  
  const { seed } = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  API.selectWallet.fromSeed(seed);
  return API.wallet().address();
}

export const loadContract = async (address: string) => {
  const dir_contract = 'data/contracts/' + address;
  const parameterized_script = await JSON.parse(fs.readFileSync(dir_contract+'/param_script.json', { encoding: 'utf-8' }))
  const state = await JSON.parse(fs.readFileSync(dir_contract+'/state.json', { encoding: 'utf-8' }))
  return {'script': parameterized_script, 'state': state}
}

// App -------------------------------------------------------------------------
const app = new Command();
app.name('state-matrix').description('A state stepping contract').version('0.0.1');

// App Command: Generate Wallet ----------------------------------------------
app
.command('wallet-new')
.description('Generate a new wallet')
.argument('<name>', 'Name of the wallet')
.action(async (name) => {
  try {
    const seed = await generateWallet(name);
    console.log(`Wallet ${name} created successfully`);
    
    // Initialize API to get address
    const API = await Lucid(
      new Kupmios(
        process.env.KUPO_ENDPOINT_PREVIEW,
        process.env.OGMIOS_ENDPOINT_PREVIEW
      ),    
      "Preview"
    );
    
    API.selectWallet.fromSeed(seed);
    const address = await API.wallet().address();
    console.log(`Address: ${address}`);
  } catch (e) {
    console.log(e);
  }
});

// App Command: List Wallets -----------------------------------------------
app
.command('wallet-list')
.description('List all wallets')
.action(() => {
  const wallets = fs.readdirSync(WALLET_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  console.log('Available wallets:');
  wallets.forEach(wallet => console.log(`- ${wallet}`));
});

// App Command: Initialize Contract --------------------------------------------
app
.command('init')
.description('Locks an asset into the transfer contract address and mints a Collateral Token')
.addOption(previewOption)
.addOption(datumOption)
.addOption(walletOption)
.action(async ({ preview, datum: datumPath, wallet }) => {
  const API = await Lucid(
    new Kupmios(
      process.env.KUPO_ENDPOINT_PREVIEW,
      process.env.OGMIOS_ENDPOINT_PREVIEW
    ),    
    "Preview"
  );
  
  console.log('Loading Wallet...')
  const address = await loadWallet(API, wallet);
  console.log('User Address:', address)  

  let contractDatum;
  if (datumPath) {
    console.log('Loading datum from:', datumPath)
    contractDatum = JSON.parse(fs.readFileSync(datumPath, { encoding: 'utf-8' }))
  } else {
    console.log('Using default datum')
    contractDatum = datum
  }

  try {
    const tx_info = await initialize(API, contractDatum, VERBOSE)
    console.log(`Contract Successfully Initialized
      \nContract data stored at: data/contracts/${tx_info.address}
      \nContract Address: ${tx_info.address}
      \nContract Policy: ${tx_info.policy_id}`
    )
    const settled = await API.awaitTx(tx_info.tx_id)
    console.log(`TX Settled: ${settled}`);
  } catch (e) {
    console.log(e);
  }
});

// App Command: Increment --------------------------------------------
app
.command('increment')
.description('Increment contract state')
.addOption(previewOption)
.addOption(addressOption)
.addOption(amountOption)
.addOption(walletOption)
.action(async ({ preview, address, amount, wallet }) => {
  const API = await Lucid(
    new Kupmios(
      process.env.KUPO_ENDPOINT_PREVIEW,
      process.env.OGMIOS_ENDPOINT_PREVIEW
    ),    
    "Preview"
  );

  console.log('Loading Wallet...')
  const userAddress = await loadWallet(API, wallet);
  console.log('User Address:', userAddress)  

  try {
    console.log('Loading Contract...')
    const contract = await loadContract(address)
    console.log('Contract Address:', address)
    
    contract.state.x = Number(contract.state.x) + amount

    const tx_info = await update_state(API, contract, VERBOSE)
    const settled = await API.awaitTx(tx_info.tx_id)
    console.log(`TX Settled: ${settled}`);
  } catch (e) {
    console.log(e);
  }
});

// App Command: Decrement ------------------------------------------
app
.command('decrement')
.description('Decrement contract state')
.addOption(previewOption)
.addOption(addressOption)
.addOption(datumOption)
.addOption(walletOption)
.action(async ({ preview, address, datum: datumPath, wallet }) => {
  const API = await Lucid(
    new Kupmios(
      process.env.KUPO_ENDPOINT_PREVIEW,
      process.env.OGMIOS_ENDPOINT_PREVIEW
    ),    
    "Preview"
  );

  console.log('Loading Wallet...')
  const userAddress = await loadWallet(API, wallet);
  console.log('User Address:', userAddress)  
  
  try {
    console.log('Loading Contract...')
    const contract = await loadContract(address)
    console.log('Contract Address:', address)

    const new_state = await JSON.parse(fs.readFileSync(datumPath, { encoding: 'utf-8' }))
    const UI_data = {
      'state': new_state,
    }  
    console.log('UI_data', UI_data)

    const tx_info = await update_state(API, contract, UI_data, VERBOSE)
    const settled = await API.awaitTx(tx_info.tx_id)
    console.log(`TX Settled: ${settled}`);
  } catch (e) {
    console.log(e);
  }
});

// App Command: Mint Test Token ------------------------------------------
app
.command('mint')
.description('Mint Test Token')
.addOption(previewOption)
.addOption(amountOption)
.addOption(walletOption)
.action(async ({ preview, amount, wallet }) => {
  const API = await Lucid(
    new Kupmios(
      process.env.KUPO_ENDPOINT_PREVIEW,
      process.env.OGMIOS_ENDPOINT_PREVIEW
    ),    
    "Preview"
  );

  console.log('Loading Wallet...')
  const userAddress = await loadWallet(API, wallet);
  console.log('User Address:', userAddress)  

  const mintingPolicy = scriptFromNative({
    type: "all",
    scripts: [
      { type: "sig", keyHash: paymentCredentialOf(userAddress).hash },
      {
        type: "before",
        slot: unixTimeToSlot(API.config().network, Date.now() + 1000000),
      },
    ],
  });

  const policyId = mintingPolicyToId(mintingPolicy);
  console.log('Policy ID:', policyId)  
  
  try {

    // Build the TX --------------------------------------------------
    const tx = await API
      .newTx()
      .mintAssets({
        [policyId + fromText("TestToken")]: BigInt(amount),
      })
      .pay.ToAddress(userAddress, { [policyId + fromText("TestToken")]: 1n })
      .validTo(Date.now() + 900000)
      .attach.MintingPolicy(mintingPolicy)
      .complete();

    // Request User Signature --------------------------------------------------
    console.log("INFO: Requesting TX signature");
    const signedTx = await tx.sign.withWallet().complete();    

    // Submit the TX -----------------------------------------------------------
    console.log("INFO: Attempting to submit the transaction");
    const txHash = await signedTx.submit();
  
    // Await TX Settlement -----------------------------------------------------------
    const settled = await API.awaitTx(txHash)
    console.log(`TX Settled: ${settled}`);

  } catch (e) {
    console.log(e);
  }
});


app.parse();
