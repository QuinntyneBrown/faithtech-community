# Estimates: admin

| Design | Effort | Complete |
|---|---|---|
| admin-users-and-override | 4 days | 95% |
| assign-roles | 5 days | 100% |
| audit-log | 4 days | 100% |
| suspend-users | 4 days | 100% |

admin-users-and-override: the admin users page and search are built, and System Admin override is in place for every record type that exists: profiles, through the API (ADR 0004) and the target-aware editor at `/people/{id}/edit`. Override and its audit for private contacts and workspaces arrive with the contacts and agile features, which own those records.
