import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MERGE_FIELDS,
  MergeChoice,
  MergeField,
  PARTNERS_SERVICE,
  PARTNER_STAGE_LABELS,
  PartnerDto,
  PartnerDuplicateDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { localDate } from '../../pages/partner/partner-timeline';

export interface MergePartnersData {
  /** The record that stays: the partner whose page opened the dialog. */
  kept: PartnerDto;
  /** The possible duplicate that is archived into it. */
  other: PartnerDto;
  /** Who added the other record and when, from the duplicate alert. */
  match: PartnerDuplicateDto | null;
}

interface FieldRow {
  field: MergeField;
  label: string;
  keep: string;
  other: string;
}

/** A field's raw value, compared to find what differs. */
function raw(partner: PartnerDto, field: MergeField): string | null {
  return field === 'owner' ? partner.ownerId : partner[field];
}

/** A field's value as the dialog writes it; "Not set" when empty. */
function shown(partner: PartnerDto, field: MergeField): string {
  if (field === 'stage') return PARTNER_STAGE_LABELS[partner.stage];
  return (field === 'owner' ? partner.ownerName : partner[field]) || 'Not set';
}

/** "Email", "Email and website", "Email, website and offering". */
function listed(labels: string[]): string {
  const words = labels.map((l, i) => (i === 0 ? l : l.toLowerCase()));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0];
}

/**
 * Compares a partner with its possible duplicate and merges the duplicate into it (L2-089),
 * matching docs/mocks/dialogs/merge-partners. One stacked radio group per field whose values
 * differ, the kept record's value selected; notes are joined, not chosen. A refusal (a 409 when
 * either record changed) shows "Partners not merged" with "Reload and try again", which reads both
 * records again and resets the choices. Closes with the kept partner.
 */
@Component({
  selector: 'ft-merge-partners-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
  ],
  templateUrl: './merge-partners.dialog.html',
  styleUrl: './merge-partners.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MergePartnersDialog {
  protected readonly ref = inject<DialogRef<PartnerDto>>(DialogRef);
  protected readonly data = inject<MergePartnersData>(DIALOG_DATA);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly kept = signal(this.data.kept);
  protected readonly other = signal(this.data.other);
  protected readonly busy = signal(false);
  /** Why the merge was refused; the confirm button becomes Reload and try again. */
  protected readonly failure = signal<string | null>(null);

  protected readonly rows = computed<FieldRow[]>(() =>
    MERGE_FIELDS.filter(({ field }) => raw(this.kept(), field) !== raw(this.other(), field)).map(
      ({ field, label }) => ({
        field,
        label,
        keep: shown(this.kept(), field),
        other: shown(this.other(), field),
      }),
    ),
  );
  protected readonly choices = computed(() => {
    const controls: Partial<Record<MergeField, FormControl<MergeChoice>>> = {};
    for (const row of this.rows()) {
      controls[row.field] = new FormControl<MergeChoice>('keep', { nonNullable: true });
    }
    return controls;
  });
  protected readonly caption = computed(() => {
    const same = MERGE_FIELDS.filter(
      ({ field }) => raw(this.kept(), field) === raw(this.other(), field),
    ).map((f) => f.label);
    const kept = `Notes from both records are joined, ${this.kept().name}’s first.`;
    if (same.length === 0) return kept;
    const verb =
      same.length === 1
        ? 'is the same on both and is kept as it is'
        : 'are the same on both and are kept as they are';
    return `${listed(same)} ${verb}. ${kept}`;
  });
  protected readonly added = computed(() => {
    const match = this.data.match;
    if (!match?.addedByName || !match.addedOn) return null;
    return `${match.addedByName} added ${this.other().name} on ${formatDay(localDate(match.addedOn))}.`;
  });

  protected control(field: MergeField): FormControl<MergeChoice> {
    return this.choices()[field]!;
  }

  protected async merge(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failure.set(null);
    const choices: Partial<Record<MergeField, MergeChoice>> = {};
    for (const row of this.rows()) choices[row.field] = this.control(row.field).value;
    try {
      this.ref.close(
        await firstValueFrom(
          this.partners.merge(this.kept().id, {
            otherId: this.other().id,
            keepVersion: this.kept().version,
            otherVersion: this.other().version,
            choices,
          }),
        ),
      );
    } catch (error) {
      const problem = problemDetails(error);
      this.failure.set(
        problem?.detail ??
          Object.values(problem?.errors ?? {})[0]?.[0] ??
          'We couldn’t reach FaithTech. Nothing was changed.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Reads both records again; the choices start from the kept record's values. */
  protected async reload(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const [kept, other] = await Promise.all([
        firstValueFrom(this.partners.get(this.kept().id)),
        firstValueFrom(this.partners.get(this.other().id)),
      ]);
      this.kept.set(kept);
      this.other.set(other);
      this.failure.set(null);
    } catch {
      this.failure.set('We couldn’t reload the partners. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
