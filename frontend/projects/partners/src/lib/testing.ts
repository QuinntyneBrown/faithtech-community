import { ORGANISATION_SERVICE, PartnerDto, PartnerStageOption } from '@faithtech-community/api';
import { of } from 'rxjs';

/** An organisation's stages as GET /api/organisation offers them, as FaithTech's seed defines them. */
export const STAGES: PartnerStageOption[] = [
  { id: 's1', key: 'lead', name: 'Lead', isInitial: true, kind: 'Open' },
  { id: 's2', key: 'in-funnel', name: 'In Funnel', isInitial: false, kind: 'Open' },
  { id: 's3', key: 'confirmed', name: 'Confirmed', isInitial: false, kind: 'Confirmed' },
];

/** ORGANISATION_SERVICE answering get() with the stages, for dialogs that offer them. */
export const organisationWithStages = (stages = STAGES) => ({
  provide: ORGANISATION_SERVICE,
  useValue: { get: () => of({ partnerStages: stages }) },
});

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
    stage: 'in-funnel',
    stageName: 'In Funnel',
    stageKind: 'Open',
    canEdit: true,
    lastActivityOn: null,
    nextStep: null,
    nextStepDue: null,
    canLogActivity: true,
    version: 1,
    archived: null,
    canRestore: false,
    ...overrides,
  };
}
