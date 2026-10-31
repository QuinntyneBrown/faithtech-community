import type { OrganisationDto } from './organisation.service';

/** The value a chapter filter sends for records with no chapter: "{Organisation}-wide" (L2-142 AC2). */
export const ORGANISATION_WIDE = 'none';

/** An option of a chapter filter, shaped as the components library's select options. */
export interface ChapterFilterOption {
  value: string;
  label: string;
}

/**
 * A chapter filter's options from GET /api/organisation (L2-142 AC1): "All {chapters}", then, on events only,
 * "{Organisation}-wide", then the active chapters in the organisation's order. Empty while chapters are off, so the
 * page renders no filter (L2-142 AC3).
 */
export function chapterFilterOptions(
  organisation: OrganisationDto,
  { organisationWide = false } = {},
): ChapterFilterOption[] {
  const label = organisation.chapterLabel;
  if (!label) return [];
  return [
    { value: '', label: `All ${label.plural.toLowerCase()}` },
    ...(organisationWide
      ? [{ value: ORGANISATION_WIDE, label: `${organisation.shortName}-wide` }]
      : []),
    ...organisation.chapters.map((c) => ({ value: c.id, label: c.name })),
  ];
}
