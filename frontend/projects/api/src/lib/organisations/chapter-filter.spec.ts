// Traces to: L2-142 AC1, AC3
import { chapterFilterOptions } from './chapter-filter';
import { OrganisationDto } from './organisation.service';

const faithTech: OrganisationDto = {
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  chapterLabel: { singular: 'City', plural: 'Cities' },
  chapters: [
    { id: 'c-toronto', name: 'Toronto' },
    { id: 'c-austin', name: 'Austin' },
  ],
  roles: [],
  partnerStages: [],
  eventTypes: [],
  resourceTypes: [],
  archivedResourceTypes: [],
};

describe('chapterFilterOptions', () => {
  it('offers every chapter in order after All', () => {
    expect(chapterFilterOptions(faithTech)).toEqual([
      { value: '', label: 'All cities' },
      { value: 'c-toronto', label: 'Toronto' },
      { value: 'c-austin', label: 'Austin' },
    ]);
  });

  it('adds the organisation-wide option for events', () => {
    expect(chapterFilterOptions(faithTech, { organisationWide: true })[1]).toEqual({
      value: 'none',
      label: 'FaithTech-wide',
    });
  });

  it('is empty while chapters are off', () => {
    expect(chapterFilterOptions({ ...faithTech, chapterLabel: null, chapters: [] })).toEqual([]);
  });
});
