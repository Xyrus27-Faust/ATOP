#!/usr/bin/env bash
# Build the ATOP web (Vite SPA -> nginx) image and push it to ECR.
#
#   ./deploy-ecr.sh [tag]            staging → :<tag> + :latest   (features ON)
#   ./deploy-ecr.sh --prod [tag]     prod    → :<tag> + :prod     (features OFF)
#
# Vite bakes VITE_* at build time, so the API URL, Google client id and the feature flags are
# passed as build args and are FROZEN INTO THE BUNDLE. There is no runtime switch: a feature is
# dark in prod only because the image was built that way.
set -euo pipefail

AWS_ACCOUNT_ID="766670502987"
AWS_REGION="ap-southeast-1"
REPO="atop-web"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO}"

PROD_API="https://api.tourismofficersph.com"
STAGING_API="https://api.staging.tourismofficersph.com"

MODE="staging"
if [[ "${1:-}" == "--prod" ]]; then MODE="prod"; shift; fi

if [[ "$MODE" == "prod" ]]; then
  # Prod ships every unreleased slice DARK. These defaults are the whole safety story: the code
  # checks `!== 'false'`, so a flag left UNSET means ENABLED — forgetting one publishes a feature.
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-$PROD_API}"
  VITE_FEATURE_SCORING="${VITE_FEATURE_SCORING:-false}"
  VITE_FEATURE_FINALS="${VITE_FEATURE_FINALS:-false}"
  MOVING_TAG="prod"
else
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-$STAGING_API}"
  VITE_FEATURE_SCORING="${VITE_FEATURE_SCORING:-true}"
  VITE_FEATURE_FINALS="${VITE_FEATURE_FINALS:-true}"
  MOVING_TAG="latest"
fi
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-857948069033-p09evikg3rk754l0hj4e4gndcjrl5ed0.apps.googleusercontent.com}"

# A bundle pointed at the prod API with a feature switched on would publish that feature to real
# users the moment it rolled out. Refuse, rather than trust whoever is at the keyboard to remember.
#
# Launching a slice for real is a legitimate thing to do, so the refusal is overridable — but only
# by PUBLISH_LIVE_FEATURES=1, typed on the command line. Deliberate, greppable in shell history, and
# impossible to reach by forgetting a flag, which is the failure this guard exists to prevent.
if [[ "$VITE_API_BASE_URL" == "$PROD_API" ]]; then
  if [[ "${PUBLISH_LIVE_FEATURES:-0}" == "1" ]]; then
    echo "!! PUBLISH_LIVE_FEATURES=1 — prod bundle with scoring=${VITE_FEATURE_SCORING} finals=${VITE_FEATURE_FINALS}" >&2
    echo "!! Any slice not 'false' above goes LIVE to real users the moment this rolls out." >&2
  else
    for flag in SCORING FINALS; do
      val="VITE_FEATURE_${flag}"
      if [[ "${!val}" != "false" ]]; then
        echo "REFUSING: building against the PROD API with VITE_FEATURE_${flag}=${!val}." >&2
        echo "          That would ship that slice live to real users." >&2
        echo "          Set VITE_FEATURE_${flag}=false, build for staging (drop --prod)," >&2
        echo "          or, if you mean to launch it, re-run with PUBLISH_LIVE_FEATURES=1." >&2
        exit 1
      fi
    done
  fi
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
echo "==> Features:   scoring=${VITE_FEATURE_SCORING}  finals=${VITE_FEATURE_FINALS}"

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
  --build-arg "VITE_FEATURE_SCORING=${VITE_FEATURE_SCORING}" \
  --build-arg "VITE_FEATURE_FINALS=${VITE_FEATURE_FINALS}" \
  -t "${ECR_URI}:${TAG}" \
  -t "${ECR_URI}:${MOVING_TAG}" \
  -f Dockerfile .

echo "==> Pushing..."
docker push "${ECR_URI}:${TAG}"
docker push "${ECR_URI}:${MOVING_TAG}"

NS=$([[ "$MODE" == "prod" ]] && echo atop-prod || echo default)
echo "==> Done: ${ECR_URI}:${TAG}"
echo "    Roll out:  kubectl set image deployment/atop-web atop-web=${ECR_URI}:${TAG} -n ${NS}"
