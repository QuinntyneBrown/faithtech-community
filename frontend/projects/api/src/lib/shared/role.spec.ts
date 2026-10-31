import { ROLE_DESCRIPTIONS, ROLES } from './role';

it('describes every role', () => {
  expect(ROLES.every((r) => ROLE_DESCRIPTIONS[r].length > 0)).toBe(true);
});
