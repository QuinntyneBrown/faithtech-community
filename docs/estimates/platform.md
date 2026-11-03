# Estimates: platform

| Design | Effort | Complete | Visual conformance |
|---|---|---|---|
| accessibility | 2 days | 90% | n/a |
| error-and-system-pages | 3 days | 100% | A+ |
| home | 3 days | 100% | A |
| input-validation-and-web-protections | 3 days | 85% | n/a |
| performance | 3 days | 60% | n/a |
| private-preview-wall | 9 days | 95% | n/a |
| reliability-and-observability | 4 days | 85% | n/a |
| responsive-layout-and-theming | 3 days | 85% | A+ |
| server-authorization | 3 days | 40% | n/a |

Private-preview wall stays at 95%: everything in the repository is built and tested (backend, e2e, container images, Bicep, deploy workflow, runbook); provisioning Azure, the DNS records and the production secrets are the owner's steps in `docs/detailed-designs/platform/private-preview-wall/runbook.md`.

Home is graded A: Recent activity shows each notification's own text as one link, as `L2-049` AC7 and the design require; the mock's sentences with a bold actor and only the target linked wait for community-wide activity (`docs/detailed-designs/platform/home`, open questions).
