import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  RESOURCES_SERVICE,
  ROLE_LABELS,
  ResourceDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  PersonOption,
  PersonPickerComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/**
 * System Admin hands a resource to another member who can own resources (L2-064 AC3 to AC6), as in
 * docs/mocks/dialogs/transfer-resource-owner. Closes with the resource under its new owner.
 */
@Component({
  selector: 'ft-transfer-ownership-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    PersonPickerComponent,
  ],
  templateUrl: './transfer-ownership.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferOwnershipDialog {
  protected readonly ref = inject<DialogRef<ResourceDto>>(DialogRef);
  protected readonly resource = inject<ResourceDto>(DIALOG_DATA);
  private readonly resources = inject(RESOURCES_SERVICE);

  protected readonly owner = new FormControl<PersonOption[]>([], { nonNullable: true });
  protected readonly chosen = signal<PersonOption | null>(null);
  protected readonly options = signal<PersonOption[]>([]);
  protected readonly searching = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly submitText = computed(() => {
    if (this.busy()) return 'Transferring…';
    if (this.failed()) return 'Try again';
    const name = this.chosen()?.name;
    return name ? `Transfer to ${name}` : 'Transfer';
  });

  constructor() {
    this.owner.valueChanges.subscribe((people) => {
      this.chosen.set(people[0] ?? null);
      this.error.set('');
    });
  }

  protected async search(q: string): Promise<void> {
    if (!q) return this.options.set([]);
    this.searching.set(true);
    try {
      const members = await firstValueFrom(this.resources.ownerCandidates(q));
      this.options.set(
        members
          .filter((m) => m.id !== this.resource.ownerId)
          .map((m) => ({
            id: m.id,
            name: m.name,
            detail: [m.roles.map((r) => ROLE_LABELS[r]).join(', '), m.city]
              .filter(Boolean)
              .join(' · '),
          })),
      );
    } catch {
      this.options.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    const owner = this.chosen();
    if (!owner) {
      this.error.set('Choose who should own it.');
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(
        await firstValueFrom(this.resources.transferOwner(this.resource.id, owner.id)),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.error.set(
          problemDetails(error)?.errors?.['OwnerId']?.[0] ?? 'Choose who should own it.',
        );
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
