import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  assignableRoles,
  AUTH_SERVICE,
  InviteDto,
  INVITES_SERVICE,
  OrganisationNames,
  problemDetails,
  Role,
  ROLE_LABELS,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

// The order the mock lists roles in: the everyday roles first, then the leads, then the admin-only ones.
const ROLE_ORDER: Role[] = [
  'Attendee',
  'Volunteer',
  'ProductEngineer',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'CityLead',
  'Staff',
  'SystemAdmin',
];
// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone by email with an optional role and note (L2-010), matching docs/mocks/dialogs/send-invite.
 * Offers only the roles the sender may grant. Closes with the new invite.
 */
@Component({
  selector: 'ft-send-invite-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    SelectComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './send-invite.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendInviteDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<InviteDto>>(DialogRef);
  private readonly invites = inject(INVITES_SERVICE);
  private readonly callerRoles = inject(AUTH_SERVICE).roles;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [''],
    role: [''],
    note: [''],
  });
  protected readonly roleOptions = computed<SelectOption[]>(() => {
    const allowed = assignableRoles(this.callerRoles());
    return [
      { value: '', label: 'No role' },
      ...ROLE_ORDER.filter((r) => allowed.includes(r)).map((r) => ({
        value: r,
        label: ROLE_LABELS[r],
      })),
    ];
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);
  protected readonly emailError = signal('');
  protected readonly noteError = signal('');

  protected async send(): Promise<void> {
    if (this.busy()) return;
    const { email, role, note } = this.form.getRawValue();
    const address = email.trim();
    this.emailError.set(EMAIL.test(address) ? '' : 'Enter an email like name@example.org.');
    this.noteError.set(note.trim().length > 500 ? 'Use 500 characters or fewer for the note.' : '');
    if (this.emailError() || this.noteError()) return;

    this.busy.set(true);
    // A select has no read-only state, so it is disabled while sending (docs/design-system dialog).
    this.form.controls.role.disable();
    this.failed.set(false);
    this.refusal.set(null);
    try {
      const invite = await firstValueFrom(
        this.invites.sendInvite({
          email: address,
          preassignedRole: (role || null) as Role | null,
          note: note.trim() || null,
        }),
      );
      this.ref.close(invite);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.emailError.set(problemDetails(error)?.errors?.['Email']?.[0] ?? '');
        if (!this.emailError()) this.refusal.set('Check the details and try again.');
      } else if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        this.refusal.set(problemDetails(error)?.detail ?? 'You can’t send invites right now.');
      } else {
        this.failed.set(true);
      }
    } finally {
      this.form.controls.role.enable();
      this.busy.set(false);
    }
  }
}
