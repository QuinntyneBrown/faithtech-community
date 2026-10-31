# 0027. Partner duplicate match rule

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-113
- Design: `docs/detailed-designs/partners/duplicate-detection-and-merge`

## Context

Every lead adds partners to one shared pipeline (ADR 0014), so leads in different cities add the same organization twice ("Kestrel Labs" and "Kestrel Labs Inc."). The partner page should warn about a likely duplicate. A lead must be able to see why two partners were matched and trust that unrelated partners are not flagged. Partners have a name, an optional website and an optional contact email; there is no other identifier.

## Decision

- Two partners are **possible duplicates** when neither is archived and either:
  - their **normalised website hosts** are equal: trim, add `http://` when no scheme is given, parse as a URI, keep the host only (dropping scheme, port, path, query and fragment), lowercase, remove one leading `www.` and a trailing dot; or
  - their **normalised names** are equal: fold accents (Unicode NFD without non-spacing marks), lowercase (invariant culture), delete punctuation and symbol characters, collapse whitespace, and remove one trailing company suffix (`inc`, `incorporated`, `ltd`, `limited`, `llc`, `corp`, `corporation`, `co`, `company`) when another word remains.
- A website match is reported before a name match, and the alert says which one applied ("with the same website, kestrel.example").
- **Email and email domain are never compared.** Shared mail providers (gmail.com, outlook.com) would flag unrelated partners, and a partner's contact can change jobs. The mock copy that mentioned email is changed to match.
- The rule is **exact on normalised keys**: no edit distance, no phonetic matching, no scoring. It lives in one pure static class, `PartnerDuplicateRules` in `Application/Partners/`, unit-tested without a database.
- Matches are computed when a partner page asks (`GET /api/partners/{id}/duplicates`), over the id, name and website of every active partner. Nothing is stored except dismissals.
- **Not the same** is stored once per unordered pair (`PartnerDuplicateDismissal`, lower id then higher id, with who and when) and hides that pair for every lead. Lead roles and System Admin may dismiss; Staff cannot.

## Consequences

- Every match can be explained in one sentence, and the same inputs always give the same answer, so tests state the rule directly.
- Near misses ("Kestrel Lab", "Kestral Labs", "Kestrel Labs Toronto") are not caught. Fuzzy matching is deferred until real duplicates show the need.
- Deleting punctuation joins hyphenated words ("Acme-Labs" becomes `acmelabs`, which does not match "Acme Labs"). This follows the requirement's wording; a later change could replace punctuation with spaces instead.
- Computing matches in memory on each page load suits a pipeline of a few thousand partners. Past that, storing the normalised host and name on `Partner` with indexes keeps the same rule with indexed lookups.
- A dismissal outlives edits: if either partner is renamed, the pair stays dismissed.
