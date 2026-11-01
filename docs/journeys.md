# User journeys

Ordered by value to the user. Effort and completion come from [estimates](estimates/README.md).


| # | Name | Description | Effort (days) | Completion (%) |
|---|---|---|---|---|
| 1 | Sign up | Create an account with email and password to join the community. | 4 | 100 |
| 2 | Sign in and out | Securely enter and leave the community with your account. | 5 | 100 |
| 3 | Verify email | Confirm your email address so your account is trusted. | 4 | 90 |
| 4 | Reset password | Regain access to your account when you forget your password. | 4 | 100 |
| 5 | View profiles | Browse member profiles to learn who is in the community. | 2 | 100 |
| 6 | Edit own profile | Keep your details current so others can find and know you. | 3 | 100 |
| 7 | Manage profile photos | Upload up to ten photos, choose a featured one, add alt text. | 5 | 100 |
| 8 | Find events | Browse and filter upcoming events across the community. | 3 | 100 |
| 9 | RSVP to events | Tell organizers you are coming to an event. | 5 | 100 |
| 10 | Search everything | Find people, events and partners from one global search box. | 4 | 90 |
| 11 | Public events and guest RSVP | Share event pages with anyone; guests RSVP without an account. | 4 | 100 |
| 12 | Add events to calendar | Download an .ics file to put an event in your calendar. | 3 | 100 |
| 13 | Receive in-app notifications | See what needs your attention in the bell, and set preferences. | 5 | 100 |
| 14 | Receive email notifications | Get important updates by email, controlled by your preferences. | 4 | 100 |
| 15 | Read announcements | Read leadership announcements and opt out of announcement emails. | 4 | 100 |
| 16 | Accept an invite | Join the community through an invitation within fourteen days. | 3 | 100 |
| 17 | Browse the team | See the city team members and their roles. | 2 | 100 |
| 18 | Create and edit events | Leads publish and update events, including hackathons. | 4 | 100 |
| 19 | Cancel events | Leads cancel an event and attendees are told. | 4 | 100 |
| 20 | Send invites | Leads invite people to sign up and track invitations. | 5 | 100 |
| 21 | Connect by QR code | City Leads show a QR code; people who scan it join and become their contacts. | 6 | 100 |
| 22 | Send announcements | Leads write announcements and send them to chosen audiences. | 4 | 100 |
| 23 | Manage private contacts | Leads keep private contacts and notes, visible only to them. | 14 | 100 |
| 24 | Archive and restore contacts | Remove contacts safely, restore them, or delete permanently. | 4 | 100 |
| 25 | Link contact on sign-up | Connect a private contact to their profile when they join, automatically through a QR code. | 6 | 100 |
| 26 | Run the partner pipeline | Move partners across a Lead, In Funnel and Confirmed Kanban board. | 8 | 100 |
| 27 | Assign roles | Leads and admins grant or remove roles within permitted limits. | 5 | 100 |
| 28 | Suspend users | Admins suspend and reinstate accounts that break community rules. | 4 | 100 |
| 29 | Administer users and override | Admins manage users and override anything, with every action recorded. | 4 | 95 |
| 30 | Review the audit log | Admins review who did what, and when. | 4 | 100 |
| 31 | Use a fast, accessible, secure site | Responsive, themed, accessible, validated and reliable on every screen. | 21 | 78 |
| 32 | Plan work in the agile workspace | Organize and track team work in a shared agile workspace. | 36 | 99 |
| 33 | Add and share resources | Leads and Staff upload decks, logos and training, or link to them, and share them with members and roles. | 12 | 98 |
| 34 | Find and download resources | Members browse, filter and search the resources visible to them, then open or download them. | 6 | 100 |
| 35 | Archive and transfer resources | Owners archive and restore resources; System Admin hands a resource to a new owner, audited. | 5 | 100 |
| 36 | Log partner activity | Leads log calls, emails, meetings and notes on a partner's shared timeline, with a next step. | 5 | 100 |
| 37 | Merge duplicate partners | Spot a partner added twice, merge the two records without losing history, or mark them as different. | 6 | 100 |
| 38 | Avoid duplicate contacts | The contact form warns a lead who already keeps a contact with the same email. | 2 | 100 |
| 39 | Check in at the door | Leads check attendees in, add walk-ins and export the attendance. | 6 | 100 |
| 40 | Read the reports | Staff and System Admins see city figures, charts and tables, filter them and export CSV. | 7 | 100 |
| 41 | Create an event hub | Leads start a hub from an event's page with a four-step wizard; the event's details fill in automatically. | 4 | 0 |
| 42 | Fill in hub sections | Leads finish a hub from its checklist, one short wizard per section: hero, agenda, venue, people, links, giving and upcoming events. | 12 | 0 |
| 43 | Preview and publish a hub | Leads preview the real page at any step, then publish, unpublish and share its link. | 3 | 0 |
| 44 | Visit an event hub | Attendees, and guests on a public event, open one page with the agenda's live "happening now", venue, people and links. | 5 | 0 |
| 45 | Start a hub from a template | Leads start from a Hackathon, Meetup or Workshop template, or copy a past hub with its dates shifted. | 5 | 0 |
| 46 | Build a hackathon hub | Leads add parking, what to bring, partners, tracks, process, rules, demo format, judging, worship and slides. | 14 | 0 |
| 47 | Edit hub templates | Organisation administrators edit the hub templates and their default text in Organisation settings. | 4 | 0 |
| 48 | Run the day from a phone | Leads post an update banner, move a session or swap a link, and the hub changes at once. | 5 | 0 |
| 49 | Share a hub by QR code | Leads show or print a QR code that opens the hub. | 1 | 0 |
| 50 | Download a hub archive | Leads download a self-contained copy of the hub, with its images and slides, to keep after the event. | 4 | 0 |

Journeys 33 to 35 (Resources) are not yet recorded in [`videos/journeys/`](videos/journeys/README.md); record them with `pwsh eng/videos/Record-JourneyVideos.ps1` once the screens are built. The app shell tour needs re-recording too, because the shell gains the Resources nav item.

Journeys 41 to 50 (Event hubs) come from the draft [event hubs proposal](proposals/event-hubs.md): 41 to 44 are its phase 1, 45 to 47 phase 2 and 48 to 50 phase 3. Their effort is a provisional sizing until `estimates/events.md` gains the event hub designs, and the journeys may change as the proposal's open questions are settled.
