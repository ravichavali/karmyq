#!/bin/bash
echo "Checking Docker status..."
docker --version 2>&1
echo ""
echo "Checking Docker Compose..."
docker compose version 2>&1
echo ""
echo "Current directory:"
pwd
echo ""
echo "Files in current directory:"
ls -la
