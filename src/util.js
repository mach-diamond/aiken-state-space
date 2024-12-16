import 'dotenv/config';
import { Core, makeValue, Data} from "@blaze-cardano/sdk";
import { AssetId, AssetName, NetworkId, PolicyId } from "@blaze-cardano/core";
// import { Blaze, Address, Assets, Value, TxBuilder, TxOutputBuilder, NativeScript, ScriptPubkey } from '@blaze-cardano/sdk';

// Initialize Lucid ------------------------------------------------------------
export const api_blockfrost = async (network) => {

  let key

  if (network == "Preview") {
    key =  process.env.BLOCKFROST_PREVIEW
  } else if (network == "Mainnet") {
    key =  process.env.BLOCKFROST_PREVIEW
  } else {
    return
  }

  const api = await Lucid.new(
    new Blockfrost(
      "https://cardano-"+network.toLowerCase()+".blockfrost.io/api/v0", 
      key),
      network,
  );

  return api;
}

const VERBOSE = true

export const mintTestToken = async (API, contractDatum) => {
  
    // Define Locked Asset and Fractional Asset ----------------------------------
    if (VERBOSE) { console.log("INFO: Defining Base and Fractional Assets") };
  
    // Define Locked Asset -------------------------------------------------------
    const assetName_baseToken      = contractDatum.base_token.assetName
    const assetPolicy_baseToken    = contractDatum.base_token.policy_id
    const quantity_baseToken       = contractDatum.base_token.quantity;
   
    const asset_baseToken          = assetPolicy_baseToken + fromText(assetName_baseToken);
    const sendAssets = {
      [asset_baseToken]: BigInt(quantity_baseToken)
    }
  
    if (VERBOSE) { console.log({
      "assetName_baseToken": assetName_baseToken,
      "assetPolicy_baseToken": assetPolicy_baseToken,
      "asset_baseToken": asset_baseToken,
      "quantity_baseToken": quantity_baseToken
      })
    }
  
    // Define Fractional Asset ---------------------------------------------------
    const assetName_sellerToken = "CollateralToken"
    const quantity_sellerToken = 1
    const metaDatum = {
      name: fromText(assetName_sellerToken),
      description: fromText("A fractional token representing partial ownership of the locked base token"),
      base_asset: {
        policy: fromText(assetPolicy_baseToken),
        asset_name: fromText(assetName_baseToken),
        quantity: BigInt(quantity_baseToken),
      },
      platform: fromText("MintMatrix.io"),
      version: 1n,
      //image: fromText(image_url),
      //mediaType:fromText(mediaType),
    };

    // Build the TX ------------------------------------------------------------
    if (VERBOSE) { console.log("INFO: Building the TX"); }

    const tx = await API.newTransaction().useEvaluator((x,y)=>API.provider.evaluateTransaction(x,y))
    .lockAssets(address,
      makeValue(0n, [asset_token, 1n]),
      scriptDatum
    )
    .addMint(
      PolicyId(policyId_Merkle_Minter),
      new Map([[AssetName(''), 1n]]),
      mintRedeemer
    )
    .provideScript(paramScript_Merkle_Minter)
    .complete();

    // Request User Signature ----------------------------------------------------
    console.log("INFO: Requesting TX signature");
    const signedTx = await API.signTransaction(tx);

    // Submit the TX -------------------------------------------------------------
    console.log("INFO: Attempting to submit the transaction");
    const txHash = await API.submitTransaction(tx);

    if (!txHash) {
      console.log("There was a change to the script's metadata")
    }
    else {
      console.log(`TX Hash Submitted: ${txHash}`);
    }

    // Return with TX hash -----------------------------------------------------
    return {
      tx_id: txHash,
      address: Address_ContractSpend,
      policy_id: policyId_Mint,
      parameters: parameters
    };
  }


  export const scriptDatumStructure = Data.Object({
    t_0:    Data.Integer(),
    x:      Data.Integer(),
    y:      Data.Integer(),
    z:      Data.Integer(),
    x_dot:      Data.Integer(),
    y_dot:      Data.Integer(),
    z_dot:      Data.Integer(),
    param:          Data.Object({
      a:            Data.Integer(),
      b:            Data.Integer(),
      c:            Data.Integer(),
      owner:       Data.Bytes(),
      asset:     Data.Object({
        policy:       Data.Bytes(),
        asset_name:   Data.Bytes(),
        quantity:     Data.Integer(),
      })
    })
  });

export const bigIntReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};
