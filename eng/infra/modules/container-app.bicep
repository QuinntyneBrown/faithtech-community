// The API container app: API, identity server, SignalR hub and both Angular builds, behind the private-preview wall
// (ADR 0023). Declared as a module so main.bicep can deploy it twice in one run: once to add the custom domains
// unbound, so their managed certificates can be issued, and once to bind them.

@description('Container app name.')
param name string
param location string
param environmentId string
param identityId string
param registryServer string
param image string

@description('Custom domains: { name, bindingType: Disabled | SniEnabled, certificateId? }.')
param customDomains array = []

@description('Key Vault secret references: { name, keyVaultUrl }.')
param secrets array

@description('Environment variables: { name, value } or { name, secretRef }.')
param env array

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identityId}': {} }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        // HTTP is redirected to HTTPS.
        allowInsecure: false
        customDomains: [for domain in customDomains: {
          name: domain.name
          bindingType: domain.bindingType
          certificateId: domain.?certificateId
        }]
      }
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
      secrets: [for secret in secrets: {
        name: secret.name
        keyVaultUrl: secret.keyVaultUrl
        identity: identityId
      }]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: env
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/health/live', port: 8080 }
              periodSeconds: 5
              failureThreshold: 24
            }
            {
              type: 'Liveness'
              httpGet: { path: '/health/live', port: 8080 }
              periodSeconds: 30
            }
          ]
        }
      ]
      // One replica: the wall's lockout state and the Data Protection key ring live in the process (ADR 0023).
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
