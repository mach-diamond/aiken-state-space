use statematrix/checks.{check_time}
use statematrix/types/state.{Asset, State, PosixTime}
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Interval}

// State Intialization, Updates, and Termination Checks ------------------------

pub fn state_initialization(
  initial_conditions: State, // Initial state of script
  base_asset: Asset,         // Locked Asset
  signer: VerificationKeyHash,
  tx_validity_range: Interval<PosixTime>
) -> Bool {


  // Check for valid numerical update, check ownership
  let correctInitialConditions = initial_conditions.x == 100
  let correctOwner = signer == initial_conditions.param.owner
  let correctActivationTime = check_time(tx_validity_range, initial_conditions.t_0)
  let correctAsset = base_asset == initial_conditions.param.asset

  // Collate logic
  and {
    correctInitialConditions,
    correctOwner,
    correctActivationTime,
    correctAsset
  }
}

pub fn state_increment(
  script_state: State,
  new_script_state: State,
  signer: VerificationKeyHash,
  tx_validity_range: Interval<PosixTime>
) -> Bool {

  // Check for valid numerical update, check ownership
  let correctNumericalUpdate = new_script_state.x == script_state.x + 10
  let correctOwner = signer == script_state.param.owner
  let unchangedTime = script_state.t_0 == new_script_state.t_0
  let unchangedParameters = script_state.param == new_script_state.param
  
  // Collate Logic
  and {
    correctNumericalUpdate,
    correctOwner,
    unchangedTime,
    unchangedParameters
  }
}

pub fn state_decrement(
  script_state: State,
  new_script_state: State,
  signer: VerificationKeyHash,
  tx_validity_range: Interval<PosixTime>
) -> Bool {

  // Check for valid numerical update, check ownership
  let correctNumericalUpdate = script_state.x == new_script_state.x - 5
  let correctOwner = signer == script_state.param.owner
  let unchangedTime = script_state.t_0 == new_script_state.t_0
  let unchangedParameters = script_state.param == new_script_state.param
  
  // Collate Logic
  and {
    correctNumericalUpdate,
    correctOwner,
    unchangedTime,
    unchangedParameters
  }
}
