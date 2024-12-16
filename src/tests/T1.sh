#!/bin/bash

# ------------------------------------------------------------------------------
# Test Case: Contract Initialization and State Updating
# ------------------------------------------------------------------------------
# Description: Tests the contract modification process where:
# 1. Test User initializes contract with default terms
# 2. Test User increments contract state
# 3. Test User decrements contract state
# ------------------------------------------------------------------------------

# Change to parent directory
cd ..

# Function to display section headers
print_header() {
    echo
    echo "----------------------------------------------"
    echo "$1"
    echo "----------------------------------------------"
}

# Initialize contract with default terms and extract address
print_header "Initializing Contract"
pnpm run execute init -p -w test-user-1 -d tests/data/T1-datum.json | tee /dev/tty | grep "Contract Address:" | cut -d':' -f2 | tr -d ' \t\n\r' > temp_address
address=$(cat temp_address)
rm temp_address
echo "Contract Address: $address"

# Update contract state - Increment
print_header "Incrementing Contract State"
pnpm run execute increment -p --address "$address" -w test-user-1 -m 10

# Update contract state - Decrement
# print_header "Decrementing Contract State"
# pnpm run execute decrement -p --address "$address" -w test-user-1 -m 5

# print_header "Test Complete"
