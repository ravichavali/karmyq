#!/bin/bash
# Debug script to verify SSH key setup
# Run this on your LOCAL machine to verify the GitHub Secret matches the server

echo "=== SSH Key Debug Script ==="
echo ""

# Step 1: Get the public key fingerprint from the server
echo "1. Getting public key from server (karmyq_deploy.pub)..."
ssh ubuntu@karmyq.com "ssh-keygen -lf ~/.ssh/karmyq_deploy.pub"
echo ""

# Step 2: Show what's in authorized_keys
echo "2. Checking authorized_keys on server..."
ssh ubuntu@karmyq.com "cat ~/.ssh/authorized_keys"
echo ""

# Step 3: Check authorized_keys permissions
echo "3. Checking permissions..."
ssh ubuntu@karmyq.com "ls -la ~/.ssh/authorized_keys"
echo ""

# Step 4: Get the private key format
echo "4. Checking private key format (first/last line)..."
ssh ubuntu@karmyq.com "head -n1 ~/.ssh/karmyq_deploy && tail -n1 ~/.ssh/karmyq_deploy"
echo ""

# Step 5: Count lines in private key
echo "5. Counting lines in private key..."
ssh ubuntu@karmyq.com "wc -l ~/.ssh/karmyq_deploy"
echo ""

echo "=== Next Steps ==="
echo "1. Copy the ENTIRE private key from the server:"
echo "   ssh ubuntu@karmyq.com 'cat ~/.ssh/karmyq_deploy'"
echo ""
echo "2. Update GitHub Secret PROD_SSH_PRIVATE_KEY with that exact content"
echo ""
echo "3. Verify the public key is in authorized_keys"
