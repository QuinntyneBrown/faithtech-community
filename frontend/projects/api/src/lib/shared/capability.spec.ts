import { CAPABILITIES, CAPABILITY_LABELS, hasAny } from './capability';

// L2-135 AC1, AC7: the app reads the platform's capabilities, never role names.
describe('CAPABILITY_LABELS', () => {
  it('names each capability as the define-role dialog shows it', () => {
    expect(CAPABILITY_LABELS.ManageEvents).toBe('Manage events');
    expect(CAPABILITY_LABELS.ViewPeopleDirectory).toBe('View people directory');
    expect(CAPABILITY_LABELS.AdministerOrganisation).toBe('Administer the organisation');
  });
});

describe('capabilities', () => {
  it('lists the platform catalogue', () => {
    expect(CAPABILITIES).toContain('ManageEvents');
    expect(CAPABILITIES).toContain('AdministerOrganisation');
    expect(CAPABILITIES.length).toBe(19);
  });

  it('holds any of the wanted capabilities', () => {
    expect(hasAny(['ViewPartners'], 'ViewPartners', 'ManagePartners')).toBe(true);
    expect(hasAny(['KeepContacts'], 'ViewPartners', 'ManagePartners')).toBe(false);
  });

  it('treats AdministerOrganisation as holding every capability', () => {
    expect(hasAny(['AdministerOrganisation'], 'ViewReports')).toBe(true);
  });
});
