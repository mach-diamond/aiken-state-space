// --- Contract Actionable Interface -------------------------------------------

// Spend actions to update the datum or retrieve ada or asset from address
pub type SpendActions {
  Owner {
    action: OwnerActionTypes
  }
}
pub type OwnerActionTypes {
  Increment         // BUYER is paying down the balance
  Decrement         // BUYER is accepting the terms
}
