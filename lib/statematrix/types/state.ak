use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId, Value}

// --- Contract State ----------------------------------------------------------

pub type State {
  t_0: PosixTime,
  x: Int,
  y: Int,
  z: Int,
  x_dot: Int,
  y_dot: Int,
  z_dot: Int,
  param: Parameters,
}
// --- Variables - Tokens ------------------------------------------------------

pub type Asset {
  policy: PolicyId,                      /// Policy ID of the minting authority
  asset_name: AssetName,                 /// Name of asset in hexidecimal
  quantity: Int,                         /// Number of token
}

// --- Variables - Parameters ------------------------------------------------------

pub type Parameters {
  a: Int,                 
  b: Int,                 
  c: Int,
  owner: VerificationKeyHash,
  asset: Asset,
}

// --- Variables - Helper struct for info about the eUTXO ---------------------

pub type ContractInfo {
  state: State,                          /// Inline Datum 
  assets: Value,                         /// Assets on eUTXO 
}

pub type PosixTime = Int
