import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AUTH_SERVICE,
  InviteDto,
  INVITES_SERVICE,
  ORGANISATION_SERVICE,
  OrganisationNames,
  problemDetails,
  Role,
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

// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone by email with an optional role and note (L2-010), matching docs/mocks/dialogs/send-invite.
 * Offers exactly the roles the server says the sender may grant, in the organisation's order (L2-010 AC2,
 * L2-137 AC5). Closes with the new invite.
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
  private readonly grantableRoleIds = inject(AUTH_SERVICE).grantableRoleIds;
  private readonly organisationRoles = toSignal(inject(ORGANISATION_SERVICE).get(), {
    initialValue: null,
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [''],
    role: [''],
    note: [''],
  });
  // Invites still record the pre-assigned role by its key.
  protected readonly roleOptions = computed<SelectOption[]>(() => {
    const allowed = this.grantableRoleIds();
    return [
      { value: '', label: 'No role' },
      ...(this.organisationRoles()?.roles ?? [])
        .filter((r) => allowed.includes(r.id))
        .map((r) => ({ value: r.key, label: r.name })),
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
