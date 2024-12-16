
import {scriptDatumStructure, bigIntReplacer} from "../util.js"
import fs from 'fs';
import {
  paymentCredentialOf,
  Constr,
  Data,
  selectUTxOs,
  fromText
} from "@lucid-evolution/lucid";

export const update_state = async (API, contract, VERBOSE=false) => {

  // Transaction Time ----------------------------------------------------------
  const currentTime = new Date().getTime() - 60 * 1000;                // (TTL: time to live)
  const laterTime = new Date(currentTime +  15 * 60 * 1000).getTime(); // 15 minutes

  if (VERBOSE) { console.log({
    'TX Validity Start:': currentTime,
    'TX Validity End:': laterTime,
    })
  }

  // Transacting Party Info ----------------------------------------------------
  const userAddress = await API.wallet().address()
  const Address_Script = contract.script.address
  const paymentCredentialHash = paymentCredentialOf(userAddress).hash

  if (VERBOSE) { console.log({
    'User Address:': userAddress,
    'User Payment Credential:': paymentCredentialHash,
    'Contract Address:': Address_Script
    })
  }

  // Define Locked Asset and Derivatives Asset ----------------------------------

  // Define Locked Asset ---------------------
  if (VERBOSE) { console.log("INFO: Defining Base Assets") };
  const assetName_baseToken      = contract.state.param.asset.asset_name
  const assetPolicy_baseToken    = contract.state.param.asset.policy
  const quantity_baseToken       = contract.state.param.asset.quantity;
  const asset_baseToken          = assetPolicy_baseToken + assetName_baseToken;
  
  if (VERBOSE) { console.log({
    "assetName_baseToken": assetName_baseToken,
    "assetPolicy_baseToken": assetPolicy_baseToken,
    "asset_baseToken": asset_baseToken,
    "quantity_baseToken": quantity_baseToken
    })
  }

  // Get Relevant TX UTXO References -------------------------------------------
  const utxos_script = await API.utxosAt(Address_Script);
  const utxos_base_asset = utxos_script.filter((object) => {
    return Object.keys(object.assets).includes(asset_baseToken);
  });
  if (VERBOSE) { console.log({
    "UTXOs (Script): ": utxos_script,
    "Base Asset UTXO (Script): ": utxos_base_asset
    })
  }

  if (!utxos_base_asset[0]) {
    console.log('Error: Base Asset Not Found at Contract Address')
    return
  }
  const adaInContract = Number(utxos_base_asset[0].assets.lovelace)

  if (VERBOSE) { console.log({
    "Base Asset UTXO (Script): ": utxos_base_asset
    })
  }

  // Configure Script Datum and Redeemer ----------------------------------------
  if (VERBOSE) { console.log("INFO: Configuring Datum"); }
  const state = {
    t_0: BigInt(contract.state.t_0),
    x: BigInt(contract.state.x),
    y: BigInt(contract.state.y),
    z: BigInt(contract.state.z),
    x_dot: BigInt(contract.state.x_dot),
    y_dot: BigInt(contract.state.y_dot),
    z_dot: BigInt(contract.state.z_dot),
    param: {
      a: BigInt(contract.state.param.a),
      b: BigInt(contract.state.param.b),
      c: BigInt(contract.state.param.c),
      owner: contract.state.param.owner,
      asset: {
        policy: contract.state.param.asset.policy,
        asset_name: contract.state.param.asset.asset_name,
        quantity: BigInt(contract.state.param.asset.quantity),
      },
    }
  }
  const scriptDatum = Data.to(state, scriptDatumStructure)

  if (VERBOSE) { console.log({
    "Proposed Contract State": state,
    })
  }

  // Spend Action: Buyer -> Pay
  const spendRedeemer = Data.to(
    new Constr(0, [new Constr(0, [])])
  );

  // Build the TX ------------------------------------------------------------
  if (VERBOSE) { console.log("INFO: Building the TX"); }

  if (VERBOSE) { console.log({
    "asset_baseToken": asset_baseToken,
    "adaInContract": adaInContract,
    })
  }

  const tx = await API.newTx()
  .collectFrom(utxos_base_asset, spendRedeemer)
  .pay.ToContract(
    Address_Script,
    { kind: "inline", value: scriptDatum },
    {
      ['lovelace']: BigInt(adaInContract),
      [asset_baseToken]: BigInt(quantity_baseToken),
    },
  )
  .attach.SpendingValidator(contract.script.Validator)
  .validFrom(currentTime)
  .validTo(laterTime)
  .addSigner(userAddress)
  .complete({canonical: false, localUPLCEval: false});

  // Request User Signature --------------------------------------------------
  console.log("INFO: Requesting TX signature");
  const signedTx = await tx.sign.withWallet().complete();

  // Submit the TX -----------------------------------------------------------
  console.log("INFO: Attempting to submit the transaction");
  const txHash = await signedTx.submit();
  
  if (txHash) {
    const dir_contract = 'data/contracts/' + Address_Script;
    fs.writeFileSync(
      dir_contract+'/state.json',
      JSON.stringify(state, bigIntReplacer, 2),
      { encoding: 'utf-8' }
    );
  }

  // Return with TX hash -----------------------------------------------------
  console.log(`TX Hash: ${txHash}`);
  return {
    tx_id: txHash,
    address: Address_Script,
  };
}