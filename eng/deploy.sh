#!/usr/bin/env bash
# Deploys FaithTech Community to Azure (ADR 0026): shared resources, images, migrations, then the API.
# Run by .github/workflows/deploy.yml, or by the owner from a shell signed in with `az login`.
#
# Required environment:
#   RESOURCE_GROUP            existing resource group, for example rg-faithtech-community
#   POSTGRES_ADMIN_PASSWORD   PostgreSQL administrator password (kept in Key Vault by the template)
# Optional:
#   IMAGE_TAG                 image tag (default: the current commit)
#   CUSTOM_DOMAINS_STAGE      none | issue | bound (default: none; see runbook.md)
#   PRIVATE_PREVIEW_ENABLED   true (default) | false to lift the wall
#   GOOGLE_SIGN_IN_ENABLED    false (default) | true once the Google secrets are in Key Vault
#   SHARED_ONLY               true to create only the shared resources (first run, before the secrets exist)
set -euo pipefail

: "${RESOURCE_GROUP:?Set RESOURCE_GROUP}"
: "${POSTGRES_ADMIN_PASSWORD:?Set POSTGRES_ADMIN_PASSWORD}"
export POSTGRES_ADMIN_PASSWORD
export CUSTOM_DOMAINS_STAGE="${CUSTOM_DOMAINS_STAGE:-none}"
export PRIVATE_PREVIEW_ENABLED="${PRIVATE_PREVIEW_ENABLED:-true}"
export GOOGLE_SIGN_IN_ENABLED="${GOOGLE_SIGN_IN_ENABLED:-false}"
root="$(cd "$(dirname "$0")/.." && pwd)"
tag="${IMAGE_TAG:-$(git -C "$root" rev-parse --short=12 HEAD)}"

deploy() {
  az deployment group create --resource-group "$RESOURCE_GROUP" --name "faithtech-$(date +%Y%m%d%H%M%S)" \
    --template-file "$root/eng/infra/main.bicep" --parameters "$root/eng/infra/main.bicepparam" \
    --query properties.outputs --output json
}

echo "1/5 Shared resources (registry, Key Vault, PostgreSQL, storage, environment)"
outputs="$(API_IMAGE='' CLI_IMAGE='' deploy)"
output() { jq -r ".$1.value" <<<"$outputs"; }
registry="$(output registryLoginServer)"
if [[ "${SHARED_ONLY:-false}" == "true" ]]; then
  echo "Shared resources are ready. Key Vault: $(output keyVaultName). Set the secrets (runbook.md), then run again."
  exit 0
fi

echo "2/5 Images $registry/faithtech-community-{api,cli}:$tag"
az acr login --name "$(output registryName)"
docker build -f "$root/backend/deploy/api.Dockerfile" -t "$registry/faithtech-community-api:$tag" "$root"
docker build -f "$root/backend/deploy/cli.Dockerfile" -t "$registry/faithtech-community-cli:$tag" "$root"
docker push "$registry/faithtech-community-api:$tag"
docker push "$registry/faithtech-community-cli:$tag"
export CLI_IMAGE="$registry/faithtech-community-cli:$tag"

echo "3/5 Cli jobs on the new image"
outputs="$(API_IMAGE='' deploy)"

run_job() {
  local job="$1" execution status
  execution="$(az containerapp job start --name "$job" --resource-group "$RESOURCE_GROUP" --query name --output tsv)"
  for _ in $(seq 1 120); do
    status="$(az containerapp job execution show --name "$job" --resource-group "$RESOURCE_GROUP" \
      --job-execution-name "$execution" --query properties.status --output tsv)"
    case "$status" in
      Succeeded) echo "$job: $execution succeeded"; return 0 ;;
      Failed | Stopped | Degraded) echo "$job: $execution $status" >&2; return 1 ;;
    esac
    sleep 10
  done
  echo "$job: $execution did not finish in 20 minutes" >&2
  return 1
}

echo "4/5 Migrate, then seed (the API never migrates on startup)"
run_job "$(output migrateJobName)"
run_job "$(output seedJobName)"

echo "5/5 API on the new image"
export API_IMAGE="$registry/faithtech-community-api:$tag"
outputs="$(deploy)"
echo "Deployed $tag. Container app: https://$(output appFqdn)"
echo "DNS verification ID (asuid TXT records): $(output customDomainVerificationId)"
