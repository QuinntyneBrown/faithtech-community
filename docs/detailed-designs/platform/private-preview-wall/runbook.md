# Runbook: deploy behind the private-preview wall

What the owner runs and supplies to put the Community platform behind the private-preview wall on its first organisation's hosts, `app.faithtech.community` and `www.faithtech.community` (the FaithTech seed, `L2-151`; ADR 0026, ADR 0032, `README.md` in this folder), and to provision further organisations (`L2-149`). Nothing here is automated from the repository: it creates Azure resources, DNS records and production secrets, which cannot be undone from a pull request. Every command is for Bash (Azure Cloud Shell, macOS, Linux or WSL) with the Azure CLI signed in (`az login`) and, for step 1, the GitHub CLI signed in (`gh auth login`). Azure Cloud Shell has no Docker: there, build the images with `az acr build --registry <registry> --image <name:tag> --file <Dockerfile> .` instead of `docker build`/`docker push`, and make the wall's hash with `dotnet run --project backend/src/FaithTech.Community.Cli -- wall-hash`.

## What the owner supplies

| Item | Where it goes |
|------|---------------|
| An Azure subscription and a region (for example `canadacentral`) | Steps 1 and 2 |
| Control of DNS for `faithtech.community`, and for each further organisation's domain | Steps 6 and 8 |
| A long private-preview passphrase (at least 16 characters; five or more random words is better) | Step 4, only its hash is stored |
| SMTP credentials (SendGrid: user name `apikey` and an API key) | Step 4 |
| A PostgreSQL administrator password (32+ random characters) | Step 2, GitHub secret |
| Optional: a Google OAuth client ID and secret (ADR 0019) | Step 4 |

Never commit any of these, paste them into an issue or pull request, or pass the passphrase as a command-line argument.

## 1. Resource group and deployment identity

```bash
RG=rg-faithtech-community
LOCATION=canadacentral
REPO=QuinntyneBrown/faithtech-community
az group create --name "$RG" --location "$LOCATION"

# An app registration that GitHub Actions signs in as, with no client secret (OpenID Connect).
APP_ID=$(az ad app create --display-name faithtech-community-deploy --query appId --output tsv)
az ad sp create --id "$APP_ID"
# GitHub presents the subject with the owner and repository IDs appended (`repo:Owner@<owner-id>/Repo@<repo-id>:...`),
# so the credential must carry that exact subject; the plain `repo:Owner/Repo:...` form is rejected (AADSTS700213).
OWNER_ID=$(gh api "users/${REPO%%/*}" --jq .id)
REPO_ID=$(gh api "repos/$REPO" --jq .id)
SUBJECT="repo:${REPO%%/*}@$OWNER_ID/${REPO##*/}@$REPO_ID:environment:production"
az ad app federated-credential create --id "$APP_ID" --parameters "{\"name\":\"production\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"$SUBJECT\",\"audiences\":[\"api://AzureADTokenExchange\"]}"
RG_ID=$(az group show --name "$RG" --query id --output tsv)
az role assignment create --assignee "$APP_ID" --role Contributor --scope "$RG_ID"
# The template grants the app's identity AcrPull and Key Vault Secrets User, so the deployer must assign roles.
az role assignment create --assignee "$APP_ID" --role "Role Based Access Control Administrator" --scope "$RG_ID"
echo "AZURE_CLIENT_ID=$APP_ID AZURE_TENANT_ID=$(az account show --query tenantId -o tsv) AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
```

## 2. GitHub settings

In the repository, **Settings → Environments → New environment** `production`. Then **Settings → Secrets and variables → Actions**:

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (printed above), `POSTGRES_ADMIN_PASSWORD`.
- Variables: `AZURE_RESOURCE_GROUP` = `rg-faithtech-community`, `CUSTOM_DOMAINS_STAGE` = `none`. Leave `DEPLOY_ENABLED` unset until step 7.

## 3. Shared resources

**Actions → Deploy → Run workflow** with *Create only the shared resources* ticked. It creates the registry, Key Vault, PostgreSQL, storage and the Container Apps environment, and stores the two secrets the template can derive (`community-db-connection`, `blob-connection`). Optional preview first (no changes): `POSTGRES_ADMIN_PASSWORD=... az deployment group what-if --resource-group "$RG" --template-file eng/infra/main.bicep --parameters eng/infra/main.bicepparam`.

## 4. Secrets in Key Vault

```bash
KV=$(az keyvault list --resource-group "$RG" --query "[0].name" --output tsv)
# The vault uses RBAC: let yourself write secrets.
az role assignment create --assignee "$(az ad signed-in-user show --query id -o tsv)" --role "Key Vault Secrets Officer" --scope "$(az keyvault show --name "$KV" --query id -o tsv)"

# The Cli image, built locally from this repository, makes the wall's hash and key.
docker build -f backend/deploy/cli.Dockerfile -t ftc-cli .

# Private-preview passphrase: typed without echo, piped on standard input, never stored. Only its PBKDF2 hash is kept.
read -rsp "Private-preview passphrase: " PASSPHRASE; echo
az keyvault secret set --vault-name "$KV" --name wall-passphrase-hash --output none \
  --value "$(printf '%s\n' "$PASSPHRASE" | docker run --rm -i ftc-cli wall-hash)"
unset PASSPHRASE
az keyvault secret set --vault-name "$KV" --name wall-signing-key --output none --value "$(docker run --rm ftc-cli wall-key)"

# OpenIddict signing and encryption certificates (production loads them as base64 PFX, no password).
for use in signing:digitalSignature encryption:keyEncipherment; do
  name=${use%%:*}; usage=${use#*:}
  openssl req -x509 -newkey rsa:2048 -nodes -days 730 -subj "/CN=Community platform $name" \
    -addext "keyUsage=critical,$usage" -keyout "$name.key" -out "$name.crt"
  openssl pkcs12 -export -inkey "$name.key" -in "$name.crt" -passout pass: -out "$name.pfx"
  az keyvault secret set --vault-name "$KV" --name "identity-$name-certificate" --output none --value "$(base64 -w0 "$name.pfx")"
  shred -u "$name.key" "$name.crt" "$name.pfx"
done

# SMTP (SendGrid: apikey and the API key).
read -rp "SMTP user name: " SMTP_USER; read -rsp "SMTP password: " SMTP_PASSWORD; echo
az keyvault secret set --vault-name "$KV" --name smtp-username --output none --value "$SMTP_USER"
az keyvault secret set --vault-name "$KV" --name smtp-password --output none --value "$SMTP_PASSWORD"
unset SMTP_PASSWORD

# Optional Google sign-in: also set the GitHub variable GOOGLE_SIGN_IN_ENABLED=true.
# az keyvault secret set --vault-name "$KV" --name google-client-id --value ...
# az keyvault secret set --vault-name "$KV" --name google-client-secret --value ...
```

The Google OAuth client's redirect URI is `https://app.faithtech.community/api/account/google/callback` (ADR 0019).

## 5. First full deploy

**Actions → Deploy → Run workflow** (box unticked). It tests the backend, pushes both images, runs `migrate` then `seed` as Container Apps jobs (the API never migrates on startup; `seed` is the production seed only: the `web` OpenIddict client with every organisation's community host as a redirect URI, the first organisation with its roles, chapters, stages and types (`L2-151`), its administrator roster and the starter resources), and then rolls out the API. The log ends with the container app's address and the DNS verification ID. `https://<address>/health/live` answers `Healthy`; any other path answers 403 with the wall page. The wall cannot be unlocked on that address, because the unlock cookie is for `faithtech.community`.

## 6. DNS and certificates

Each organisation has a community host and a public host (`L2-131`); these records are for the first organisation. At the DNS provider for `faithtech.community`:

| Type | Name | Value |
|------|------|-------|
| CNAME | `app` | the container app address from step 5 |
| CNAME | `www` | the container app address from step 5 |
| TXT | `asuid.app` | the DNS verification ID from step 5 |
| TXT | `asuid.www` | the DNS verification ID from step 5 |

When the records resolve (`dig +short CNAME app.faithtech.community`), set the GitHub variable `CUSTOM_DOMAINS_STAGE` = `issue` and run **Deploy**: it adds both hosts, has Azure issue a managed certificate for each, and binds them. Then set `CUSTOM_DOMAINS_STAGE` = `bound` and leave it there. HTTP is redirected to HTTPS and every response carries HSTS.

## 7. Check, then deploy on every push

1. Open `https://www.faithtech.community`: only "Private preview" and the passphrase field. Unlock: the marketing page appears, and `https://app.faithtech.community` opens without asking again.
2. `curl -sI https://app.faithtech.community/api/me` → `403`, `X-Robots-Tag: noindex, nofollow`, no `Server` header.
3. Set the variable `DEPLOY_ENABLED` = `true` to deploy every push to `main`.

## 8. Provision an organisation

A platform operator (an account listed in `Platform:Operators`, `L2-148`) provisions each further organisation with the Cli image through the same temporary firewall opening as below (`L2-149`):

```bash
docker run --rm -e ConnectionStrings__Community="$(az keyvault secret show --vault-name "$KV" --name community-db-connection --query value -o tsv)" ftc-cli \
  org create --slug acme --host app.acme.example --name "Acme Community" --short-name Acme --chapter-label Campus/Campuses --admin-email admin@acme.example
```

The command is idempotent: run again with the same fields it reports that the organisation exists. It creates the organisation with the Administrator and Member roles and the default stages and types, and sends the first administrator an invite pre-assigned Administrator, recorded in the platform audit log (`org audit`). Then, at the DNS provider for the organisation's domain, create the same CNAME and `asuid` TXT records as step 6 for its community host and its public host (`www.` plus the host, or the host the organisation chose), add both hosts to the custom domains parameter in `eng/infra/main.bicepparam` and the organisation's host entry to the API configuration, set `CUSTOM_DOMAINS_STAGE` = `issue`, run **Deploy**, then set it back to `bound` and deploy once more. A host outside the cookie domain `faithtech.community` needs its own unlock while the wall is on (`L2-104` AC2). `org suspend <slug> --reason "..."` and `org lift <slug>` suspend and lift an organisation (`L2-150`).

## Make yourself an administrator

Sign up on `app.faithtech.community` and verify the email, then run the Cli's `grant-admin` from your machine through a temporary firewall opening. It grants the role carrying `AdministerOrganisation` (seeded as System Admin in FaithTech):

```bash
PG=$(az postgres flexible-server list --resource-group "$RG" --query "[0].name" --output tsv)
az postgres flexible-server firewall-rule create --resource-group "$RG" --name "$PG" --rule-name owner-once --start-ip-address "$(curl -s https://api.ipify.org)"
docker run --rm -e ConnectionStrings__Community="$(az keyvault secret show --vault-name "$KV" --name community-db-connection --query value -o tsv)" ftc-cli grant-admin you@example.org
az postgres flexible-server firewall-rule delete --resource-group "$RG" --name "$PG" --rule-name owner-once --yes
```

## Rotate the passphrase

Repeat the `wall-passphrase-hash` lines of step 4 with the new passphrase, then restart the API so it reads the new secret. Existing unlocks stay valid; rotate the key too to end them.

```bash
restart() {
  az containerapp revision restart --resource-group "$RG" --name ftc-api \
    --revision "$(az containerapp show --resource-group "$RG" --name ftc-api --query properties.latestRevisionName -o tsv)"
}
restart
```

## Revoke every unlock

Replace the signing key and restart: every `__Secure-unlock` cookie stops working at once, including the owner's.

```bash
az keyvault secret set --vault-name "$KV" --name wall-signing-key --output none --value "$(docker run --rm ftc-cli wall-key)"
restart
```

A restart also clears lockouts, which live in memory.

## Lift the wall

Set the GitHub variable `PRIVATE_PREVIEW_ENABLED` = `false` and run **Deploy**. Every organisation's hosts are then open to everyone, `X-Robots-Tag` and the wall's `robots.txt` stop, and organisation resolution, sign-in and every permission rule apply exactly as before. To put the wall back, set it to `true` and deploy.

## Known limits

- One replica: lockouts and the Data Protection key ring are in memory, so a restart clears lockouts and invalidates outstanding verification, reset and unsubscribe links (ADR 0026; persisting the key ring is deferred).
- The apex `faithtech.community` is not served or redirected (deferred).
