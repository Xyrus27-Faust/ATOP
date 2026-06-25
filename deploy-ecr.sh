#!/usr/bin/env bash
# Build the ATOP web (Vite SPA -> nginx) image and push it to ECR.
# Usage: ./deploy-ecr.sh [tag]
#
# Vite bakes VITE_* at build time, so the staging API URL + Google client id
# are passed as build args here (override via env before running if needed).
set -euo pipefail

AWS_ACCOUNT_ID="766670502987"
AWS_REGION="ap-southeast-1"
REPO="atop-web"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO}"

# Staging build-time config (override by exporting before running).
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.staging.tourismofficersph.com}"
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-857948069033-p09evikg3rk754l0hj4e4gndcjrl5ed0.apps.googleusercontent.com}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%Y%m%d-%H%M)}"

echo "==> ECR:        ${ECR_URI}"
echo "==> Tag:        ${TAG} (+ latest)"
echo "==> API base:   ${VITE_API_BASE_URL}"

aws ecr describe-repositories --repository-names "$REPO" --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$AWS_REGION" \
       --image-scanning-configuration scanOnPush=true \
       --encryption-configuration encryptionType=AES256 >/dev/null

echo "==> Authenticating Docker to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> Building (linux/amd64)..."
docker build --platform linux/amd64 \
  --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL}" \
  --build-arg "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" \
  -t "${ECR_URI}:${TAG}" \
  -t "${ECR_URI}:latest" \
  -f Dockerfile .

echo "==> Pushing..."
docker push "${ECR_URI}:${TAG}"
docker push "${ECR_URI}:latest"

echo "==> Done: ${ECR_URI}:${TAG}"
echo "    Roll out:  kubectl set image deployment/atop-web atop-web=${ECR_URI}:${TAG} -n default"
