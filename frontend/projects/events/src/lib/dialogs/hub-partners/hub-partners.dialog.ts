import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, PARTNERS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconTileComponent,
  ListSkeletonComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom, startWith } from 'rxjs';

import {
  HubPreviewLinkComponent,
  HubSectionWizardData,
  SectionSaver,
  sectionContent,
  textOrNull,
} from '../../hub-sections';

const MAX_PARTNERS = 6;

interface Partner {
  id: string;
  name: string;
  offering: string | null;
  initials: string;
}

/** "BT" for Baptize The World: the first letters of the first two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

let next = 0;

/**
 * The Partners wizard (L2-175 AC1), matching docs/mocks/dialogs/hub-partners: the organisation's partners read from
 * Partners, searched by name and ticked (up to 6), and the "Meet our partner" paragraph. A partner ticked before a
 * search hides it stays ticked. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-partners-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconTileComponent,
    ListSkeletonComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-partners.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-partners.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPartnersDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HubSectionWizardData>(DIALOG_DATA);
  protected readonly hub = this.data.hub;
  /** Set when the wizard edits a template's default (ADR 0043). */
  protected readonly template = this.data.template;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Partners',
    this.template,
  );
  private readonly partnersService = inject(PARTNERS_SERVICE);

  protected readonly questionId = `hub-partners-q-${++next}`;
  protected readonly max = MAX_PARTNERS;
  /** The organisation's partners, null while loading. */
  protected readonly partners = signal<Partner[] | null>(null);
  protected readonly loadFailed = signal(false);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly picked = new FormControl<string[]>([], { nonNullable: true });
  protected readonly meet = new FormControl('', { nonNullable: true });

  private readonly query = toSignal(this.search.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });
  private readonly pickedIds = toSignal(
    this.picked.valueChanges.pipe(startWith(this.picked.value)),
    { initialValue: [] as string[] },
  );
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.partners() ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  });
  protected readonly noMatch = computed(() => `No partners match “${this.query().trim()}”.`);
  /** "2 of 6 picked. You can pick up to 6 partners." */
  protected readonly countLine = computed(
    () =>
      `${this.pickedIds().length} of ${MAX_PARTNERS} picked. You can pick up to ${MAX_PARTNERS} partners.`,
  );

  constructor() {
    const content = sectionContent(this.hub, 'Partners');
    this.picked.setValue((content?.partners ?? []).map((p) => p.id));
    this.meet.setValue(content?.meet ?? '');
    void this.load();
  }

  /** Every card on the board, in board order, once each. */
  protected async load(): Promise<void> {
    this.loadFailed.set(false);
    this.partners.set(null);
    try {
      const board = await firstValueFrom(this.partnersService.getBoard());
      const seen = new Set<string>();
      const partners: Partner[] = [];
      for (const card of board.columns.flatMap((c) => c.cards)) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        partners.push({
          id: card.id,
          name: card.name,
          offering: card.offering,
          initials: initials(card.name),
        });
      }
      this.partners.set(partners);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected clearSearch(): void {
    this.search.setValue('');
  }

  protected async save(): Promise<void> {
    // In board order, so the hub lists them as Partners does.
    const order = (this.partners() ?? []).map((p) => p.id);
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
    const saved = await this.saver.save({
      partnerIds: [...this.picked.value].sort((a, b) => rank(a) - rank(b)),
      meet: textOrNull(this.meet.value),
    });
    if (saved) this.ref.close(true);
  }
}
