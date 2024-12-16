import contract from "../scripts/statematrix.json" assert { type: "json" };
import {scriptDatumStructure, bigIntReplacer} from "../util.js"
import fs from 'fs';
import {
  paymentCredentialOf,
  Constr,
  Data,
  applyParamsToScript,
  validatorToScriptHash,
  validatorToAddress,
  fromText
} from "@lucid-evolution/lucid";

export const config_metadata = async (template, init_state) => {

  template.base_asset.asset_name = init_state.base_asset.asset_name
  template.base_asset.policy_id = init_state.base_asset.policy
  template.base_asset.quantity = init_state.base_asset.quantity

  console.log('Metadata:', template)

  return template
}

// #############################################################################
// ## SEND BASE TOKEN TO MARKET + MINT COLLATERAL TOKEN
// #############################################################################
export const initialize = async (API, init_state, VERBOSE=false) => {

  // Transaction Time ----------------------------------------------------------
  const currentTime = new Date().getTime() - 60 * 1000;                // (TTL: time to live)
  const laterTime = new Date(currentTime +  15 * 60 * 1000).getTime(); // 15 minutes

  if (VERBOSE) { console.log({
    'TX Validity Start:': currentTime,
    'TX Validity End:': laterTime,
    })
  }

  // Initialize Lucid ------------------------------------------------------------
  const userAddress = await API.wallet().address()
  const paymentCredentialHash = paymentCredentialOf(userAddress).hash
  if (VERBOSE) { console.log({
    'User Address:': userAddress,
    'Payment Credential:': paymentCredentialHash
    })
  }

  // Define Locked Asset and Fractional Asset ----------------------------------
  if (VERBOSE) { console.log("INFO: Defining Base and Derivate Assets") };

  // Define Locked Asset -------------------------------------------------------
  const assetName_baseToken      = init_state.param.asset.asset_name
  const assetPolicy_baseToken    = init_state.param.asset.policy
  const quantity_baseToken       = init_state.param.asset.quantity;
  const asset_baseToken          = assetPolicy_baseToken + fromText(assetName_baseToken);

  if (VERBOSE) { console.log({
    "assetName_baseToken": assetName_baseToken,
    "assetPolicy_baseToken": assetPolicy_baseToken,
    "asset_baseToken": asset_baseToken,
    "quantity_baseToken": quantity_baseToken
    })
  }

  // Get the User's UTXOs ------------------------------------------------------
  const utxos_user = await API.utxosAt(userAddress);
  const utxos_base_asset = utxos_user.filter((object) => {
    return Object.keys(object.assets).includes(asset_baseToken);
  });
  const utxo_base_asset = utxos_base_asset[0]

  if (!utxo_base_asset) {
    console.log('Error: Base Asset Not Found')
    return
  }
  
  const consumingUserUTXO = new Constr(0, [
    utxo_base_asset.txHash,
    BigInt(utxo_base_asset.outputIndex),
  ]);

  if (VERBOSE) { console.log({
    // "User UTXOs": utxos_user,
    "Base Asset UTXO": utxo_base_asset,
    })
  }

  // Parameterize Contracts ----------------------------------------------------
  if (VERBOSE) { console.log("INFO: Parameterizing Contracts"); }

  const Script_Parameterized = {
    type: "PlutusV3",
    script: applyParamsToScript(
      contract.cborHex ,
      [assetPolicy_baseToken, fromText(assetName_baseToken), BigInt(quantity_baseToken), consumingUserUTXO]
    ),
  };

  const policyId_Script =  validatorToScriptHash(Script_Parameterized)
  const Address_Script =  validatorToAddress("Preview", Script_Parameterized)

  // Save Parameterized Validator
  // if (VERBOSE) { console.log("INFO: Mint Validator", Script_Parameterized); }

  // Check if the directory exists
  const dir_contract = 'data/contracts/' + Address_Script;
  if (!fs.existsSync(dir_contract)) {
    fs.mkdirSync(dir_contract, { recursive: true }, (err) => {
      if (err) throw err;
      console.log('Directory created:', dir_contract);
    });
  }

  fs.writeFileSync(dir_contract+'/param_script.json', JSON.stringify({
    'Validator': Script_Parameterized,
    'hash': policyId_Script,
    'address': Address_Script
  }), { encoding: 'utf-8' });

  // Configure Script Datum and Redeemer ----------------------------------------
  if (VERBOSE) { console.log("INFO: Configuring Datum"); }

  const state = {
    t_0: BigInt(laterTime),
    x: BigInt(init_state.x),
    y: BigInt(init_state.y),
    z: BigInt(init_state.z),
    x_dot: BigInt(init_state.x_dot),
    y_dot: BigInt(init_state.y_dot),
    z_dot: BigInt(init_state.z_dot),
    param: {
      a: BigInt(init_state.param.a),
      b: BigInt(init_state.param.b),
      c: BigInt(init_state.param.c),
      owner: paymentCredentialHash,
      asset: {
        policy: init_state.param.asset.policy,
        asset_name: fromText(assetName_baseToken),
        quantity: BigInt(init_state.param.asset.quantity),
      },
    }
  }

  const scriptDatum = Data.to(state, scriptDatumStructure)

  if (VERBOSE) { console.log({
    "Contract State": state,
    "Contract Address": Address_Script
    })
  }

  fs.writeFileSync(
    dir_contract+'/state.json',
    JSON.stringify(state, bigIntReplacer, 2),
    { encoding: 'utf-8' }
  );

  // Mint Action: AssetCollateral -> Mint
  const mintRedeemer = Data.to(
    new Constr(0, [new Constr(0, [])])
  ); 

  if (VERBOSE) { console.log({
    "scriptDatum": scriptDatum,
    "mintRedeemer": mintRedeemer,
    })
  }

  // Build the TX ------------------------------------------------------------
  if (VERBOSE) { console.log("INFO: Building the TX"); }

  const tx = await API.newTx()
  .pay.ToContract(
    Address_Script,
    { kind: "inline", value: scriptDatum },
    { [asset_baseToken]: BigInt(quantity_baseToken) },
  )
  .collectFrom([utxo_base_asset])  
  .attach.MintingPolicy(Script_Parameterized)
  .addSigner(userAddress)
  .complete({localUPLCEval: false});

  // Request User Signature --------------------------------------------------
  console.log("INFO: Requesting TX signature");
  const signedTx = await tx.sign.withWallet().complete();

  // Submit the TX -----------------------------------------------------------
  console.log("INFO: Attempting to submit the transaction");
  const txHash = await signedTx.submit();

  // Return with TX hash -----------------------------------------------------
  console.log(`TX Hash: ${txHash}`);
  return {
    tx_id: txHash,
    address: Address_Script,
    policy_id: policyId_Script,
  };
}