import { ROLE_DESCRIPTIONS, ROLES, assignableRoles, isLead } from './role';

describe('assignableRoles', () => {
  it('gives a System Admin every role', () => {
    expect(assignableRoles(['SystemAdmin'])).toEqual([...ROLES]);
  });

  it('gives a City Lead the six roles L2-009 allows, in display order', () => {
    expect(assignableRoles(['CityLead'])).toEqual([
      'EventLead',
      'CreateLead',
      'CommunicationsLead',
      'Volunteer',
      'ProductEngineer',
      'Attendee',
    ]);
  });

  it('gives anyone else nothing', () => {
    expect(assignableRoles(['Staff', 'EventLead', 'Volunteer'])).toEqual([]);
    expect(assignableRoles([])).toEqual([]);
  });
});

describe('isLead', () => {
  it('is true for any lead role or System Admin', () => {
    expect(isLead(['CommunicationsLead'])).toBe(true);
    expect(isLead(['SystemAdmin'])).toBe(true);
    expect(isLead(['Staff', 'Volunteer'])).toBe(false);
  });
});

it('describes every role', () => {
  expect(ROLES.every((r) => ROLE_DESCRIPTIONS[r].length > 0)).toBe(true);
});
