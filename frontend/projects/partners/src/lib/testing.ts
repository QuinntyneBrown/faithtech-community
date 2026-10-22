import { PartnerDto } from '@faithtech-community/api';

/** A partner as the API returns it, for the specs. */
export function partnerDto(overrides: Partial<PartnerDto> = {}): PartnerDto {
  return {
    id: 'x1',
    name: 'Kestrel Labs',
    website: 'kestrel.example',
    offering: 'Venue for Builders Night',
    ownerId: 'p1',
    ownerName: 'Grace Okonkwo',
    contactName: 'Nadia Petrov',
    email: 'nadia@kestrel.example',
    phone: '416-555-0199',
    notes: 'Studio of 12 developers.',
    stage: 'InFunnel',
    canEdit: true,
    lastActivityOn: null,
    nextStep: null,
    nextStepDue: null,
    canLogActivity: true,
    ...overrides,
  };
}
