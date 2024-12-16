use aiken/collection/list
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference,
  Transaction, find_input,
}
use cardano/address.{Address, Script}
use cardano/assets.{flatten}
use statematrix/checks.{
  output_has_token
}
use statematrix/state_transitions.{
  state_increment, state_decrement
}
use statematrix/types/actions.{
  SpendActions, Owner, Increment, Decrement
}
use statematrix/types/state.{State}

// --- Amortized Asset Transfer Smart Contract ---------------------------------
validator statematrix(
  base_token_policy: ByteArray,
  base_token_name: ByteArray,
  base_token_quantity: Int,
  spent_utxo: OutputReference,
) {

  // --- Spend Validation Logic  -----------------------------------------------
  spend(
    datum: Option<State>,
    spend_validation: SpendActions,
    self_utxo_reference: OutputReference,
    tx: Transaction,
  ) {

    // Deconstruct the transaction components
    let Transaction {
      inputs,
      outputs,
      extra_signatories,
      validity_range,
      ..
    } = tx

    // Get the script's own input going into the tx 
    expect Some(self_input) = find_input(inputs, self_utxo_reference)

    // Get the script's input credential
    let Input {
      output: Output {
        address: Address { payment_credential, .. },
        ..
      },
      ..
    } = self_input
    expect Script(script_policy_id) = payment_credential

    // Get the recipient's credential
    expect [signer] = extra_signatories

    // Get the UTXO thats going into this contract address
    expect Some(self_output) =
      outputs
        |> list.filter(fn(output) { output.address == self_input.output.address })
        |> list.head()

    // Assets going into script
    let remaining_at_script =
      outputs
        |> list.filter(fn(output) { output.address == self_input.output.address })
        |> list.flat_map(fn(output) { flatten(output.value) })

    // The original tokens at the script address
    let original_tokens = flatten(self_input.output.value)

    // Find tokens that were at the script address but are no longer there
    let token_claims =
      original_tokens
        |> list.filter(fn(token) {
          !list.any(remaining_at_script, fn(remaining) { remaining == token })
        })

    // Get the current sitting datum on this UTXO and the new incoming datum
    expect InlineDatum(maybe_script_state) = self_input.output.datum
    expect InlineDatum(maybe_new_script_state) = self_output.datum

    // Expect the datum to match out defined datum structure
    expect script_state: State = maybe_script_state
    expect new_script_state: State = maybe_new_script_state

    trace @"Spend Pre-Amble Complete"

    // Selection of the logic gates for the spending behavior of the contract's UTXO 

    when spend_validation is {
      Owner {action} ->
        when action is {
          // Add 
          Increment -> {
            trace @"Spend Action: Add to State"

            {

              let baseTokenNOTRedeemed =
                !output_has_token(
                  token_claims,
                  base_token_policy,
                  base_token_name,
                  Some(base_token_quantity),
                )
              let isValidStateUpdate =
                state_increment(
                  script_state,
                  new_script_state,
                  signer,
                  validity_range
                )

              // Collate validation logic
              and {
                baseTokenNOTRedeemed,
                isValidStateUpdate,
              }
            }
          }
          // Subtract
          Decrement -> {
            trace @"Spend Action: Subtract from State"
            {

              let notBaseToken =
                !output_has_token(
                  token_claims,
                  base_token_policy,
                  base_token_name,
                  Some(base_token_quantity),
                )

              let isValidStateUpdate =
                state_decrement(
                  script_state,
                  new_script_state,
                  signer,
                  validity_range
                )

              // Collate validation logic
              and {
                notBaseToken,
                isValidStateUpdate,
              }
            }
          }
        }
    }

  }

}
