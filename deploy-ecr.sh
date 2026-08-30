#!/usr/bin/env bash
# Build the ATOP web (Vite SPA -> nginx) image and push it to ECR.
#
#   ./deploy-ecr.sh [tag]            staging → :<tag> + :latest
#   ./deploy-ecr.sh --prod [tag]     prod    → :<tag> + :prod
#
# Vite bakes VITE_* at build time, so the API URL and Google client id are passed as build args and
# are FROZEN INTO THE BUNDLE. The two environments differ only in which API they point at.
#
# There are no feature flags. There used to be three (scoring, finals, events), and the difference
# between what they defaulted to and what prod actually ran is what took convention registration and
# scoring off prod on 2026-08-30: the defaults said "dark", prod said "live", and a routine
# --prod build believed the defaults. What ships is now decided by what is merged, not by
# remembering a flag.
set -euo pipefail

AWS_ACCOUNT_ID="766670502987"
AWS_REGION="ap-southeast-1"
REPO="atop-web"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO}"

PROD_API="https://api.tourismofficersph.com"
STAGING_API="https://api.staging.tourismofficersph.com"

# --- prod ships from main, and only from main -------------------------------
# The branch is the whole point of having a staging line: work lands on staging, gets looked at on
# the staging environment, and reaches prod by being merged into main. A prod image built from
# anywhere else quietly skips that. Overridable by DEPLOY_FROM_ANY_BRANCH=1 — typed on the command
# line, greppable in shell history, and impossible to reach by forgetting which branch you are on.
require_main_branch() {
  local branch behind
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

  if [[ "${DEPLOY_FROM_ANY_BRANCH:-0}" == "1" ]]; then
    echo "!! DEPLOY_FROM_ANY_BRANCH=1 — building a PROD image from '${branch}'." >&2
    return 0
  fi

  if [[ "$branch" != "main" ]]; then
    echo "REFUSING: a prod image is built from main, not '${branch}'." >&2
    echo "          Merge staging into main first (that is what promoting means)," >&2
    echo "          or re-run with DEPLOY_FROM_ANY_BRANCH=1 if you mean to bypass it." >&2
    exit 1
  fi

  # Behind the remote means someone else has promoted something this build would silently drop.
  git fetch --quiet origin main 2>/dev/null || true
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
    if [[ "$behind" != "0" ]]; then
      echo "REFUSING: main is ${behind} commit(s) behind origin/main. Pull first." >&2
      exit 1
    fi
  fi
}

MODE="staging"
if [[ "${1:-}" == "--prod" ]]; then MODE="prod"; shift; fi

if [[ "$MODE" == "prod" ]]; then
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-$PROD_API}"
  MOVING_TAG="prod"
else
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-$STAGING_API}"
  MOVING_TAG="latest"
fi
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-857948069033-p09evikg3rk754l0hj4e4gndcjrl5ed0.apps.googleusercontent.com}"

if [[ "$VITE_API_BASE_URL" == "$PROD_API" ]]; then
  require_main_branch

  # :latest is what staging rolls out — pushing it from a prod build would put a prod-API bundle
  # onto staging. Not overridable: that's tag hygiene, never an intentional launch.
  if [[ "$MOVING_TAG" == "latest" ]]; then
    echo "REFUSING: a prod-API build must not push :latest (that tag is staging's). Use --prod." >&2
    exit 1
  fi
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%Y%m%d-%H%M)}"

echo "==> Mode:       ${MODE}"
echo "==> ECR:        ${ECR_URI}"
echo "==> Tag:        ${TAG} (+ ${MOVING_TAG})"
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
  -t "${ECR_URI}:${MOVING_TAG}" \
  -f Dockerfile .

echo "==> Pushing..."
docker push "${ECR_URI}:${TAG}"
docker push "${ECR_URI}:${MOVING_TAG}"

NS=$([[ "$MODE" == "prod" ]] && echo atop-prod || echo default)
echo "==> Done: ${ECR_URI}:${TAG}"
echo "    Roll out:  kubectl set image deployment/atop-web atop-web=${ECR_URI}:${TAG} -n ${NS}"
