// FaithTech Community on Azure Container Apps (ADR 0026, docs/detailed-designs/platform/private-preview-wall).
// One container app serves app.faithtech.community (community app, API, identity server) and
// www.faithtech.community (marketing page) behind the private-preview wall. Every secret lives in Key Vault; this
// template holds none. Runbook: docs/detailed-designs/platform/private-preview-wall/runbook.md.

targetScope = 'resourceGroup'

@description('Short prefix for resource names.')
@minLength(3)
@maxLength(8)
param namePrefix string = 'ftc'

param location string = resourceGroup().location

@description('Host of the community app, API and identity server.')
param appHost string = 'app.faithtech.community'

@description('Host of the marketing page.')
param wwwHost string = 'www.faithtech.community'

@description('Parent domain for the unlock cookie, so one unlock covers both hosts.')
param cookieDomain string = 'faithtech.community'

@description('API image, for example <registry>/faithtech-community-api:<commit>. Empty leaves the container app as it is.')
param apiImage string = ''

@description('Cli image, for example <registry>/faithtech-community-cli:<commit>. Empty leaves the migrate and seed jobs as they are.')
param cliImage string = ''

@description('none: no custom domains yet. issue: add both domains, issue their managed certificates and bind them (DNS must exist). bound: certificates exist; keep them bound.')
@allowed(['none', 'issue', 'bound'])
param customDomainsStage string = 'none'

@description('The private-preview wall. Set to false to lift it (L2-107).')
param privatePreviewEnabled bool = true

@description('Adds the Google sign-in secrets (google-client-id, google-client-secret) to the app.')
param googleSignInEnabled bool = false

param smtpHost string = 'smtp.sendgrid.net'
param smtpPort int = 587
param smtpFrom string = 'FaithTech Community <no-reply@faithtech.community>'

param postgresAdminLogin string = 'ftcadmin'

@secure()
@description('PostgreSQL administrator password; stored only in Key Vault as part of the connection string.')
param postgresAdminPassword string

var suffix = uniqueString(resourceGroup().id)
var appOrigin = 'https://${appHost}'
var wwwOrigin = 'https://${wwwHost}'
var hosts = [appHost, wwwHost]
// The deploy runs migrations before the API rolls out: the jobs are deployed when a Cli image is given, the app when an
// API image is given (eng/deploy.sh).
var deployJobs = !empty(cliImage)
var deployApp = !empty(apiImage)
var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var keyVaultSecretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-identity'
  location: location
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${namePrefix}acr${suffix}'
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRole)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRole
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

var vaultName = '${namePrefix}-kv-${take(suffix, 10)}'
// Known at the start of the deployment, unlike vault.properties.vaultUri, so loops can use it.
var vaultUri = 'https://${vaultName}${az.environment().suffixes.keyvaultDns}/'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, keyVaultSecretsUserRole)
  scope: vault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRole
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${namePrefix}st${suffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${namePrefix}-pg-${suffix}'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }

  resource database 'databases' = {
    name: 'faithtech_community'
  }

  // 0.0.0.0 admits Azure services only (the container app and the Cli job), not the internet.
  resource azureServices 'firewallRules' = {
    name: 'AllowAzureServices'
    properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
  }
}

// The two secrets this template can derive. Every other secret is set by the owner (runbook.md).
resource communityConnection 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'community-db-connection'
  properties: {
    value: 'Host=${postgres.properties.fullyQualifiedDomainName};Port=5432;Database=faithtech_community;Username=${postgresAdminLogin};Password=${postgresAdminPassword};SSL Mode=Require'
  }
}

resource blobConnection 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'blob-connection'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
  }
}

var secretNames = concat(
  [
    'community-db-connection'
    'blob-connection'
    'identity-signing-certificate'
    'identity-encryption-certificate'
    'smtp-username'
    'smtp-password'
    'wall-passphrase-hash'
    'wall-signing-key'
  ],
  googleSignInEnabled ? ['google-client-id', 'google-client-secret'] : []
)

var appSecrets = [for secret in secretNames: {
  name: secret
  keyVaultUrl: '${vaultUri}secrets/${secret}'
}]

var appEnv = concat(
  [
    { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
    // The client address is the last X-Forwarded-For entry, which the ingress appends (L2-103 AC5).
    { name: 'ASPNETCORE_FORWARDEDHEADERS_ENABLED', value: 'true' }
    { name: 'WebApp__Origin', value: appOrigin }
    { name: 'Marketing__Origin', value: wwwOrigin }
    { name: 'StaticSites__ImageOrigins', value: take(storage.properties.primaryEndpoints.blob, length(storage.properties.primaryEndpoints.blob) - 1) }
    { name: 'PrivatePreview__Enabled', value: string(privatePreviewEnabled) }
    { name: 'PrivatePreview__CookieDomain', value: cookieDomain }
    { name: 'PrivatePreview__PassphraseHash', secretRef: 'wall-passphrase-hash' }
    { name: 'PrivatePreview__SigningKey', secretRef: 'wall-signing-key' }
    { name: 'ConnectionStrings__Community', secretRef: 'community-db-connection' }
    { name: 'ConnectionStrings__Blobs', secretRef: 'blob-connection' }
    { name: 'Identity__SigningCertificate', secretRef: 'identity-signing-certificate' }
    { name: 'Identity__EncryptionCertificate', secretRef: 'identity-encryption-certificate' }
    { name: 'Smtp__Host', value: smtpHost }
    { name: 'Smtp__Port', value: string(smtpPort) }
    { name: 'Smtp__UseTls', value: 'true' }
    { name: 'Smtp__From', value: smtpFrom }
    { name: 'Smtp__UserName', secretRef: 'smtp-username' }
    { name: 'Smtp__Password', secretRef: 'smtp-password' }
  ],
  googleSignInEnabled
    ? [
        { name: 'Google__ClientId', secretRef: 'google-client-id' }
        { name: 'Google__ClientSecret', secretRef: 'google-client-secret' }
      ]
    : []
)

var appName = '${namePrefix}-api'
var unboundDomains = [for host in hosts: { name: host, bindingType: 'Disabled' }]

// Stage "issue" first adds the domains unbound: a managed certificate can only be issued for a hostname the app has.
module appUnbound 'modules/container-app.bicep' = if (deployApp && customDomainsStage != 'bound') {
  name: 'api-app'
  dependsOn: [acrPull, secretsUser, communityConnection, blobConnection]
  params: {
    name: appName
    location: location
    environmentId: environment.id
    identityId: identity.id
    registryServer: registry.properties.loginServer
    image: apiImage
    secrets: appSecrets
    env: appEnv
    customDomains: customDomainsStage == 'issue' ? unboundDomains : []
  }
}

resource certificates 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = [for host in hosts: if (deployApp && customDomainsStage != 'none') {
  parent: environment
  name: replace(host, '.', '-')
  location: location
  dependsOn: [appUnbound]
  properties: {
    subjectName: host
    domainControlValidation: 'CNAME'
  }
}]

module appBound 'modules/container-app.bicep' = if (deployApp && customDomainsStage != 'none') {
  name: 'api-app-bound'
  dependsOn: [acrPull, secretsUser, communityConnection, blobConnection]
  params: {
    name: appName
    location: location
    environmentId: environment.id
    identityId: identity.id
    registryServer: registry.properties.loginServer
    image: apiImage
    secrets: appSecrets
    env: appEnv
    customDomains: [for (host, i) in hosts: {
      name: host
      bindingType: 'SniEnabled'
      certificateId: certificates[i].id
    }]
  }
}

// The Cli runs as two manual jobs on the same image: migrate, then seed (the production seed only). The API never
// migrates on startup (AGENTS.md).
resource cliJobs 'Microsoft.App/jobs@2024-03-01' = [for command in ['migrate', 'seed']: if (deployJobs) {
  name: '${namePrefix}-${command}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull, secretsUser, communityConnection]
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: [
        {
          name: 'community-db-connection'
          keyVaultUrl: '${vaultUri}secrets/community-db-connection'
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'cli'
          image: cliImage
          args: [command]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'ConnectionStrings__Community', secretRef: 'community-db-connection' }
            { name: 'WebApp__Origin', value: appOrigin }
          ]
        }
      ]
    }
  }
}]

output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output keyVaultName string = vault.name
output appName string = appName
output appFqdn string = deployApp ? (customDomainsStage == 'none' || customDomainsStage == 'issue' ? appUnbound!.outputs.fqdn : appBound!.outputs.fqdn) : ''
@description('Value of the asuid TXT records for both hosts.')
output customDomainVerificationId string = environment.properties.customDomainConfiguration.customDomainVerificationId
output migrateJobName string = '${namePrefix}-migrate'
output seedJobName string = '${namePrefix}-seed'
