import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { PartnerDto, PartnerOwnerDto, PartnerRequest } from '@faithtech-community/api';
import { SelectOption } from '@faithtech-community/components';

/** The partner fields the add-partner dialog and the partner form share (L2-017). */
export type PartnerField =
  'name' | 'website' | 'offering' | 'ownerId' | 'contactName' | 'email' | 'phone' | 'notes';

export const PARTNER_FIELDS: PartnerField[] = [
  'name',
  'website',
  'offering',
  'ownerId',
  'contactName',
  'email',
  'phone',
  'notes',
];

export const NAME_MESSAGE = 'Enter the organisation’s name.';
export const EMAIL_MESSAGE = 'Enter an email like name@example.org, or leave it empty.';
// Loose check that mirrors the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function partnerForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    name: [''],
    website: [''],
    offering: [''],
    ownerId: [''],
    contactName: [''],
    email: [''],
    phone: [''],
    notes: [''],
  });
}

export type PartnerFormValue = Record<PartnerField, string>;

export function fromPartner(partner: PartnerDto): PartnerFormValue {
  return {
    name: partner.name,
    website: partner.website ?? '',
    offering: partner.offering ?? '',
    ownerId: partner.ownerId ?? '',
    contactName: partner.contactName ?? '',
    email: partner.email ?? '',
    phone: partner.phone ?? '',
    notes: partner.notes ?? '',
  };
}

export function toRequest(value: PartnerFormValue): PartnerRequest {
  const blank = (v: string) => v.trim() || null;
  return {
    name: value.name.trim(),
    website: blank(value.website),
    offering: blank(value.offering),
    ownerId: value.ownerId || null,
    contactName: blank(value.contactName),
    email: blank(value.email),
    phone: blank(value.phone),
    notes: blank(value.notes),
  };
}

/** The errors the browser can find before saving. */
export function clientErrors(value: PartnerFormValue): Partial<Record<PartnerField, string>> {
  const errors: Partial<Record<PartnerField, string>> = {};
  if (!value.name.trim()) errors.name = NAME_MESSAGE;
  const email = value.email.trim();
  if (email && !EMAIL.test(email)) errors.email = EMAIL_MESSAGE;
  return errors;
}

/** Maps the API's validation problem details (PascalCase keys) onto the fields. */
export function serverErrors(error: unknown): Partial<Record<PartnerField, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<PartnerField, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = PARTNER_FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}

export function ownerOptions(owners: PartnerOwnerDto[]): SelectOption[] {
  return [
    { value: '', label: 'No owner' },
    ...owners.map((o) => ({ value: o.profileId, label: o.name })),
  ];
}
