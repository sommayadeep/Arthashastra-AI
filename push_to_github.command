#!/bin/bash

# ASHSTRASHASTRA AI - GitHub Push Script
# Run this script to push your code to GitHub

cd /Users/sommayadeepsaha/Desktop/ASHSTRASHASTRA_AI

echo "=========================================="
echo "Pushing to GitHub..."
echo "=========================================="

# Add all files
git add .

# Commit with message
git commit -m "Add Flask backend for Render deployment + Vercel frontend"

# Push to GitHub
git push origin main

echo "=========================================="
echo "Push complete!"
echo "=========================================="

