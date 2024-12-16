#!/bin/bash

print_header() {
    echo
    echo "----------------------------------------------"
    echo "$1"
    echo "----------------------------------------------"
}
create_or_use_wallet() {
    local wallet_name=$1
    local output_file=$2
    local wallets_dir="../wallets"  # Changed to use relative path from /src/tests

    mkdir -p "$wallets_dir"

    if [ -z "$wallet_name" ] || [ -z "$output_file" ]; then
        echo "Error: Wallet name and output file are required"
        return 1
    fi
    
    if [ -f "${wallets_dir}/${wallet_name}.json" ]; then
        echo "Wallet '$wallet_name' already exists"
        read -r -p "Would you like to overwrite it? (y/N): " choice
        if [[ $choice =~ ^[Yy]$ ]]; then
            rm "${wallets_dir}/${wallet_name}.json" && \
            pnpm run execute wallet-new "$wallet_name" > "$output_file" 2>&1 && \
            echo "Created new $wallet_name wallet" || \
            { echo "Error creating wallet"; return 1; }
        else
            pnpm run execute init -p -w "$wallet_name" > "$output_file" 2>&1 && \
            echo "Using existing $wallet_name wallet" || \
            { echo "Error initializing wallet"; return 1; }
        fi
    else
        pnpm run execute wallet-new "$wallet_name" > "$output_file" 2>&1 && \
        echo "Created new $wallet_name wallet" || \
        { echo "Error creating wallet"; return 1; }
    fi
    
    return 0
}

print_header "Creating Wallets"
create_or_use_wallet "test-user-1" "wallet1.txt"
wallet1_address=$(grep "Address:" wallet1.txt | cut -d':' -f2 | tr -d " '\t\n\r")

print_header "Wallet Addresses"
echo "Test User 1 Wallet: $wallet1_address"

print_header "Funding Instructions"
echo "Please follow these steps:"
echo "1. Visit https://docs.cardano.org/cardano-testnet/tools/faucet"
echo "2. Copy this address: $wallet1_address"
echo "3. Request test ada from the faucet"
echo -n "Press Enter once you've received the test funds in the wallet (wait some time for the fauce TX to clear)..."
read

print_header "Minting Test Tokens"
echo "Minting 10,000 test tokens..."
pnpm run execute mint -p -w test-user-1 -m 10000 2>&1 | tee mint_output.txt
policy_id=$(grep "Policy ID:" mint_output.txt | cut -d':' -f2 | tr -d ' \t\n\r')

print_header "Updating Datum Files"
for i in {1..4}; do
    datum_file="data/T${i}-datum.json"
    if [ -f "$datum_file" ]; then
        echo "Updating $datum_file..."
        sed -i.bak "s/\"policy\":[[:space:]]*\"[^\"]*\"/\"policy\": \"$policy_id\"/" "$datum_file" && rm "${datum_file}.bak"
    fi
done

print_header "Setup Complete"
pnpm run execute wallet-list
echo
echo "Test User 1 Address: $wallet1_address"
echo "Token Policy ID: $policy_id"

rm wallet1.txt mint_output.txt