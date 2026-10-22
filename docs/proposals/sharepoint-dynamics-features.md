# SharePoint and Dynamics features: what to adopt

A quick review of Microsoft SharePoint and Dynamics 365 features, and whether FaithTech Community should adopt each one. Effort is relative: S (days), M (1 to 2 weeks), L (several weeks).

- Date: 2026-10-22
- Status: for discussion; any "Yes" still needs a proposal, spec, design and mock before code.

## SharePoint

| Feature | Description | Adopt? | Rationale | Effort |
| --- | --- | --- | --- | --- |
| Document libraries | Shared folders of files with metadata, check-in/out and permissions. | Yes | Already covered by the Resources proposal: upload or link, tags and visibility. Build that rather than a full document library. | M |
| Version history | Keeps prior versions of a file and lets users restore them. | Later | Useful once Resources is live and decks get revised; replacing a file is enough for v1. | S |
| Co-authoring | Several people edit an Office file at the same time. | No | Leads already co-author in Google Docs or Office; Community should link to those, not rebuild an editor. | L |
| News posts | Rich article pages published to a site and rolled up to a feed. | Partly | Announcements already cover this; add rich text and images to announcements rather than a separate news feature. | S |
| Intranet sites and pages | Drag-and-drop pages built from web parts for each team or topic. | No | A page builder is costly and duplicates profiles, events and resources. City pages could come later as a focused feature. | L |
| Lists | Configurable tables with custom columns, views and forms. | No | Generic lists invite unmodelled data; contacts, partners and agile work items already model what leads track. | L |
| Enterprise search | Search across sites, files and people with refiners. | Already | Global Postgres full-text search exists; extend it to Resources rather than adopting refiners now. | S |
| Metadata and tagging | Managed terms used to classify and filter content. | Yes | A shared tag set across resources, events and partners keeps search and filters consistent. | M |
| Alerts and follow | Notify a user when a file, page or list changes. | Partly | Notifications exist; add "follow" for events and resources if members ask for it. | S |
| Sharing links and guest access | Share content with people outside the organisation. | Partly | Public events already do this; keep everything else members-only, per the domain rules. | S |
| Retention and records | Policies that keep or delete content after set periods. | Later | Needed for contacts and audit log data protection; a simple retention job beats a policy engine. | M |
| Power Automate workflows | Low-code flows triggered by content changes, such as approvals. | No | Few approval flows exist; code the ones we need (for example, resource review) in handlers. | L |

## Dynamics 365

| Feature | Description | Adopt? | Rationale | Effort |
| --- | --- | --- | --- | --- |
| Contact and account management | Central records of people and organisations with history. | Already | Private contacts and partners cover this; keep the lead-only privacy rule rather than Dynamics-style shared records. | S |
| Opportunity pipeline | Stage-based tracking of deals with value and close dates. | Already | The partner Kanban (Lead, In Funnel, Confirmed) is the pipeline; add an expected-commitment field only if leads ask. | S |
| Activity timeline | Calls, emails, meetings and notes logged against a record. | Yes | Contact notes exist; a dated timeline of touchpoints per partner helps hand-over when leads change. | M |
| Marketing journeys | Segmented email campaigns with automated sends and tracking. | No | Announcements with opt-out cover community email; campaigns add consent and deliverability burden we do not need. | L |
| Event management | Registration, sessions, check-in and attendee follow-up. | Partly | Events and RSVP exist; event check-in is the gap worth adding before v2 hackathons. | M |
| Customer service cases | Tickets with queues, SLAs and resolution tracking. | No | Member support volume is low; the support email and GitHub issues are enough. | L |
| Dashboards and reports | Configurable charts over records, such as pipeline and activity. | Yes | Staff want city-level numbers (members, events, partners); a fixed read-only dashboard is cheap and fits Staff's role. | M |
| Project operations | Projects, resourcing, time entry and billing. | No | Agile workspaces cover project work; time entry and billing do not apply to volunteers. | L |
| Finance (ledger, invoices) | General ledger, payables, receivables and budgeting. | No | Finance belongs in the accounting system; Community holds no money and should not. | L |
| Donor and grant management | Track gifts, pledges and grants (Nonprofit Accelerator). | Later | Partner commitments may grow into this; revisit once partners record pledges, not before. | L |
| Role-based security | Security roles granting record and field level access. | Already | Global roles with server-side checks already exist; no need for field-level security yet. | S |
| Duplicate detection | Flags likely duplicate contacts and accounts and supports merge. | Yes | Contacts link on sign-up by email, but leads in different cities can add the same partner twice. | S |
