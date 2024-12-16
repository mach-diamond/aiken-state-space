use aiken/collection/dict
use aiken/interval.{Finite, Interval, contains}
use aiken/collection/list
use cardano/transaction.{Input, OutputReference}
use cardano/assets.{AssetName, PolicyId, Value, tokens, quantity_of, flatten}
use statematrix/types/state.{Asset, PosixTime}
use aiken/crypto.{VerificationKeyHash}
use statematrix/parameters.{fifteen_min_in_msec}
// Claim Validity Checks -------------------------------------------------------

pub fn check_ownership(
  owner: VerificationKeyHash,
  claimant: VerificationKeyHash,
) -> Bool {
  owner == claimant
}

pub fn output_has_token(
  out_tokens: List<(ByteArray, ByteArray, Int)>,
  search_policy: ByteArray,
  search_name: ByteArray,
  search_quantity: Option<Int>,
) {
  when search_quantity is {
    Some(number) ->
      out_tokens
        |> list.has((search_policy, search_name, number))
    None -> {
      let finds =
        out_tokens
          |> list.filter(
               fn(token) {
                 let (token_policy, token_name, _) = token
                 token_policy == search_policy && token_name == search_name
               },
             )
      list.length(finds) > 0
    }
  }
}

pub fn has_unique_input(inputs: List<Input>, spent_utxo: OutputReference) {
  // Ensures the script is parameterized by a unique UTXO input being spent
  list.any(inputs, fn(input) { 
    input.output_reference == spent_utxo 
    })
}

pub fn has_buyer(maybe_buyer: Option<VerificationKeyHash>) {
  // Checks if there is a value in the buyer field
  when maybe_buyer is {
    Some(_) -> True
    None -> False
  }
}

pub fn has_start_time(maybe_start_time: Option<Int>) {
  // Checks if there is a value in the buyer field
  when maybe_start_time is {
    Some(_) -> True
    None -> False
  }
}

pub fn valid_mint(
  mint: Value,
  token_policy: PolicyId,
  token_name: ByteArray,
  quantity: Int,
) -> Bool {
  expect [Pair(mint_token_name, mint_amount)] =
    mint
      |> tokens(token_policy)
      |> dict.to_pairs

  mint_amount == quantity && mint_token_name == token_name
}

/// Checks to see if a timestamp is within a valid interval range. 
/// Returns true if no lock time is provided

pub fn check_time(range: Interval<PosixTime>, timestamp: PosixTime) {

  expect Finite(t_0) = range.lower_bound.bound_type
  expect Finite(t_1) = range.upper_bound.bound_type

  let isFifteenMinRange = (t_1 - t_0) == (fifteen_min_in_msec)
  let isWithinBounds = contains(range, timestamp)

  and {
    isFifteenMinRange,
    isWithinBounds
  }
}

pub fn value_contains_token(tokens: Value, asset: Asset) -> Bool {
  quantity_of(tokens, asset.policy, asset.asset_name) == asset.quantity
}

///
pub fn has_target_lovelace(target: Value, total: Value) -> Bool {
  let flat: List<(PolicyId, AssetName, Int)> = flatten(target)
  do_contains(flat, total)
}

fn do_contains(flat: List<(PolicyId, AssetName, Int)>, total: Value) -> Bool {
  when flat is {
    [(pid, tkn, amt), ..rest] ->
      if quantity_of(total, pid, tkn) >= amt {
        do_contains(rest, total)
      } else {
        // something is missing
        False
      }
    // found all of them
    [] -> True
  }
}
