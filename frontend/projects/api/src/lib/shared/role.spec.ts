import { ROLE_DESCRIPTIONS, ROLES, assignableRoles } from './role';

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
it('describes every role', () => {
  expect(ROLES.every((r) => ROLE_DESCRIPTIONS[r].length > 0)).toBe(true);
});
