use aiken/builtin

/// Throws an error if list isn't [x]
/// More efficient than expect until Microproofs fixes the traces in expect
pub fn expect_unique(list: List<x>) -> x {
  if builtin.null_list(builtin.tail_list(list)) {
    builtin.head_list(list)
  } else {
    error
  }
}
