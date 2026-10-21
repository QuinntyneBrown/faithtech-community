# Security policy

FaithTech Community stores personal data, including private contact notes, so we take security
seriously and appreciate responsible disclosure.

## Supported versions

The project is pre-release. Security fixes are made on the `main` branch. Once releases begin, this
table will list the supported versions.

| Version | Supported |
|---|---|
| `main` | ✅ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions or pull
requests.**

Report them privately using GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
(the **Report a vulnerability** button on the repository's **Security** tab).

Please include as much of the following as you can:

- The type of issue (for example, broken access control, injection, cross-site scripting)
- The affected area, file paths or endpoints
- The steps, configuration or proof of concept needed to reproduce it
- The impact, including what an attacker could access

Areas we especially want to hear about:

- Access to another lead's **private contacts** or notes
- **Role escalation**, such as a City Lead granting City Lead, Staff or System Admin
- Access to Agile workspaces by non-members
- Authentication, token or session handling (OpenIddict, PKCE)
- Exposure of members-only data to anonymous visitors

## What to expect

- We will acknowledge your report within **3 business days**.
- We will keep you informed while we investigate and fix the issue.
- We will credit you in the advisory once it is fixed, unless you prefer to stay anonymous.

Please give us reasonable time to fix the issue before disclosing it publicly.
