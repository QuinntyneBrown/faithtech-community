import { EMAIL_MESSAGE, NAME_MESSAGE, PartnerFormValue, unfixedErrors } from './partner-fields';

const value = (fields: Partial<PartnerFormValue>): PartnerFormValue => ({
  name: '',
  website: '',
  offering: '',
  ownerId: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
  ...fields,
});

describe('unfixedErrors', () => {
  it('drops a name error once the name is filled in', () => {
    expect(unfixedErrors({ name: NAME_MESSAGE }, value({ name: 'Lantern Foundation' }))).toEqual(
      {},
    );
  });

  it('keeps an email error while the email is still malformed', () => {
    expect(
      unfixedErrors(
        { name: NAME_MESSAGE, email: EMAIL_MESSAGE },
        value({ name: 'Lantern', email: 'ada@' }),
      ),
    ).toEqual({ email: EMAIL_MESSAGE });
  });

  it('keeps an error only the server can check until the next save', () => {
    expect(unfixedErrors({ website: 'Too long.' }, value({ website: 'x' }))).toEqual({
      website: 'Too long.',
    });
  });
});
