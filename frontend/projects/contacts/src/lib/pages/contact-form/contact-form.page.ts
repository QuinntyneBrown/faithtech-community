import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CONTACTS_SERVICE, ContactDto, ContactRequest } from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  PageHeaderComponent,
  PictureListComponent,
  PictureListPhoto,
  SkeletonComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Field = 'name' | 'email' | 'phone' | 'organization' | 'city' | 'notes';
type State = 'loading' | 'loaded' | 'error';

const FIELDS: Field[] = ['name', 'email', 'phone', 'organization', 'city', 'notes'];
// Loose checks that mirror the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MESSAGE = 'Enter at least a first name.';
const EMAIL_MESSAGE = 'Enter an email like name@example.org, or leave it empty.';
// The error summary words the client-side errors as short links (docs/mocks/pages/contact-form/invalid).
const SUMMARY: Record<string, string> = {
  [NAME_MESSAGE]: 'Enter a name',
  [EMAIL_MESSAGE]: 'Enter a valid email',
};
// The photo rules the server checks too (L2-057).
const MISSING_ALT = 'Describe this photo.';
const MAX_ALT = 300;
const LONG_ALT = `Use ${MAX_ALT} characters or fewer to describe this photo.`;

/** A photo chosen on the add-contact form; it uploads after the contact is created (ADR 0017). */
interface ChosenPhoto {
  file: File;
  url: string | null;
  alt: string;
  featured: boolean;
}

/**
 * Add or edit a private contact (L2-013), matching docs/mocks/pages/contact-form. Without `id` it
 * creates a contact with an optional first note and photos (L2-055), offering "Save and link" when the
 * email belongs to a member; with `id` it edits that contact. Chosen photos upload after the contact is
 * created, featured first; any that fail are named on the contact page.
 */
@Component({
  selector: 'ft-contact-form-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    PageHeaderComponent,
    PictureListComponent,
    SkeletonComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './contact-form.page.html',
  styleUrl: './contact-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormPage {
  private readonly contacts = inject(CONTACTS_SERVICE);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly nameField = viewChild('nameField', { read: FormFieldComponent });
  private readonly emailField = viewChild('emailField', { read: FormFieldComponent });
  private readonly pictureList = viewChild(PictureListComponent);

  /** Route parameter when editing. */
  readonly id = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    email: [''],
    phone: [''],
    organization: [''],
    city: [''],
    notes: [''],
  });
  protected readonly editing = computed(() => !!this.id());
  protected readonly state = signal<State>('loaded');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly contact = signal<ContactDto | null>(null);
  /** The member who already uses the email; saving then links the contact to them (L2-013 AC6). */
  protected readonly member = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });
  protected readonly photos = signal<ChosenPhoto[]>([]);
  protected readonly altErrors = computed(() =>
    this.photos().map((p) => {
      if (!this.submitted()) return '';
      const alt = p.alt.trim();
      return alt === '' ? MISSING_ALT : alt.length > MAX_ALT ? LONG_ALT : '';
    }),
  );
  protected readonly listPhotos = computed<PictureListPhoto[]>(() =>
    this.photos().map((p, i) => ({
      url: p.url,
      alt: p.alt,
      featured: p.featured,
      pending: true,
      altError: this.altErrors()[i],
    })),
  );
  protected readonly summary = computed<FormError[]>(() => [
    ...this.errors().map((e) => ({
      message: SUMMARY[e.message] ?? e.message,
      fieldId: this.fieldOf(e.field),
    })),
    ...this.altErrors().flatMap((error, i) =>
      error
        ? [
            {
              message: error === MISSING_ALT ? `Describe photo ${i + 1}` : error,
              fieldId: this.pictureList()?.descriptionFieldId(i) ?? '',
            },
          ]
        : [],
    ),
  ]);
  protected readonly cancelHref = computed(() =>
    this.id() ? `/contacts/${this.id()}` : '/contacts',
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
    // A different email may not belong to that member, so ask again.
    this.form.controls.email.valueChanges.subscribe(() => this.member.set(null));
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected pick(files: File[]): void {
    this.photos.update((list) => [
      ...list,
      ...files.map((file, i) => ({
        file,
        url: previewUrl(file),
        alt: '',
        featured: list.length === 0 && i === 0,
      })),
    ]);
  }

  protected describe({ index, alt }: { index: number; alt: string }): void {
    this.photos.update((list) => list.map((p, i) => (i === index ? { ...p, alt } : p)));
  }

  protected feature(index: number): void {
    this.photos.update((list) => list.map((p, i) => ({ ...p, featured: i === index })));
  }

  /** A chosen photo is not saved yet, so removing it needs no confirmation. */
  protected remove(index: number): void {
    const removed = this.photos()[index];
    revokePreview(removed?.url ?? null);
    this.photos.update((list) => {
      const rest = list.filter((_, i) => i !== index);
      return removed?.featured && rest.length
        ? rest.map((p, i) => ({ ...p, featured: i === 0 }))
        : rest;
    });
  }

  protected retry(): void {
    const id = this.id();
    if (id) void this.load(id);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    if (this.errors().length || this.altErrors().some(Boolean) || this.busy()) {
      this.errorFocus()?.focusFirstError();
      return;
    }

    this.busy.set(true);
    const value = this.form.getRawValue();
    const details: ContactRequest = {
      name: value.name.trim(),
      email: blank(value.email),
      phone: blank(value.phone),
      organization: blank(value.organization),
      city: blank(value.city),
    };
    try {
      const id = this.id();
      const saved = await firstValueFrom(
        id
          ? this.contacts.update(id, details)
          : this.contacts.create({
              ...details,
              notes: blank(value.notes),
              linkToMember: this.member() !== null,
            }),
      );
      if (id || this.photos().length === 0) {
        await this.router.navigateByUrl(`/contacts/${saved.id}`);
      } else {
        const failedPhotos = await this.uploadPhotos(saved.id);
        await this.router.navigateByUrl(`/contacts/${saved.id}`, { state: { failedPhotos } });
      }
    } catch (error) {
      const member = memberName(error);
      const fieldErrors = validationErrors(error);
      if (member) this.member.set(member);
      else if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      if (!member) this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  /** Uploads the chosen photos, featured first so the server features it; returns the descriptions that failed. */
  private async uploadPhotos(contactId: string): Promise<string[]> {
    const ordered = [...this.photos()].sort((a, b) => Number(b.featured) - Number(a.featured));
    const failed: string[] = [];
    for (const photo of ordered) {
      try {
        await firstValueFrom(this.contacts.uploadPhoto(contactId, photo.file, photo.alt.trim()));
      } catch {
        failed.push(photo.alt.trim());
      }
    }
    for (const photo of ordered) revokePreview(photo.url);
    return failed;
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const contact = await firstValueFrom(this.contacts.get(id));
      this.contact.set(contact);
      this.form.setValue({
        name: contact.name,
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        organization: contact.organization ?? '',
        city: contact.city ?? '',
        notes: '',
      });
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const value = this.form.controls[field].value.trim();
    if (field === 'name') return value ? '' : NAME_MESSAGE;
    if (field === 'email') return !value || EMAIL.test(value) ? '' : EMAIL_MESSAGE;
    return '';
  }

  private fieldOf(field: Field): string {
    const formField = field === 'email' ? this.emailField() : this.nameField();
    return formField?.controlId() ?? '';
  }
}

function previewUrl(file: File): string | null {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
}

function revokePreview(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function blank(value: string): string | null {
  return value.trim() || null;
}

/** The member named by a 409 from create: the email belongs to them (ADR 0014). */
function memberName(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const name = (error.error as { memberName?: unknown } | null)?.memberName;
  return typeof name === 'string' ? name : null;
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
