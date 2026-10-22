// Production parameters. No secrets: the PostgreSQL administrator password comes from the environment (the deploy
// workflow's POSTGRES_ADMIN_PASSWORD secret); every other secret is set in Key Vault (runbook.md).
using './main.bicep'

param namePrefix = 'ftc'
param appHost = 'app.faithtech.community'
param wwwHost = 'www.faithtech.community'
param cookieDomain = 'faithtech.community'
param apiImage = readEnvironmentVariable('API_IMAGE', '')
param cliImage = readEnvironmentVariable('CLI_IMAGE', '')
param customDomainsStage = readEnvironmentVariable('CUSTOM_DOMAINS_STAGE', 'none')
param privatePreviewEnabled = bool(readEnvironmentVariable('PRIVATE_PREVIEW_ENABLED', 'true'))
param googleSignInEnabled = bool(readEnvironmentVariable('GOOGLE_SIGN_IN_ENABLED', 'false'))
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
