# Estimates: platform

| Design | Effort | Complete | Visual conformance |
|---|---|---|---|
| accessibility | 2 days | 90% | n/a |
| error-and-system-pages | 3 days | 100% | C+ |
| home | 3 days | 100% | C+ |
| input-validation-and-web-protections | 3 days | 85% | n/a |
| performance | 3 days | 60% | n/a |
| private-preview-wall | 9 days | 95% | n/a |
| reliability-and-observability | 4 days | 85% | n/a |
| responsive-layout-and-theming | 3 days | 85% | C+ |
| server-authorization | 3 days | 40% | n/a |

Private-preview wall stays at 95%: everything in the repository is built and tested (backend, e2e, container images, Bicep, deploy workflow, runbook); provisioning Azure, the DNS records and the production secrets are the owner's steps in `docs/detailed-designs/platform/private-preview-wall/runbook.md`.
