import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  EVENT_HUBS_SERVICE,
  HubPersonDto,
  HubPersonInput,
  HubPersonRole,
  PEOPLE_SERVICE,
  PersonSummary,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  ButtonComponent,
  ClusterComponent,
  DialogComponent,
  FormFieldComponent,
  InlineMessageComponent,
  ListComponent,
  ListItemComponent,
  PersonOption,
  PersonPickerComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
  avatarColorFor,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubPreviewLinkComponent,
  HubPeopleComponent,
  HubSectionWizardData,
  SectionSaver,
  sectionContent,
} from '../../hub-sections';

const STEPS = ['People', 'Review'] as const;
const MAX_PEOPLE = 60;
const MAX_NAME = 80;
const MAX_LINE = 120;
const ROLES: SelectOption[] = [
  { value: 'Mentor', label: 'Mentor' },
  { value: 'Judge', label: 'Judge' },
  { value: 'Speaker', label: 'Speaker' },
];

/** A person on the list: a member by profile id, or a guest kept on the hub only. */
interface PersonRow {
  key: string;
  profileId: string | null;
  name: string;
  line: string | null;
  photoUrl: string | null;
  /** "Member · Communications Lead · Toronto" or "Guest · Founder, Kestrel Labs". */
  description: string;
  role: FormControl<HubPersonRole>;
}

type Action = 'next' | 'later' | 'finish';

let next = 0;

/**
 * The People wizard (L2-161, L2-157), matching docs/mocks/dialogs/hub-people: step 1 lists the people with a role on
 * the day each and Remove, adds members from a search of the organisation's members or guests by name and a line;
 * step 2 reviews them grouped as the hub shows them. Members are saved by profile id only, so the hub reads their
 * current name and photo. Closes with true once saved and done.
 */
@Component({
  selector: 'ft-hub-people-dialog',
  imports: [
    HubPreviewLinkComponent,
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    ButtonComponent,
    ClusterComponent,
    DialogComponent,
    FormFieldComponent,
    HubPeopleComponent,
    InlineMessageComponent,
    ListComponent,
    ListItemComponent,
    PersonPickerComponent,
    SelectComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-people.dialog.html',
  styleUrls: ['../hub-wizard.scss', './hub-people.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPeopleDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'People',
  );
  private readonly directory = inject(PEOPLE_SERVICE);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly steps = STEPS;
  protected readonly roles = ROLES;
  protected readonly statusId = `hub-people-step-${++next}`;
  protected readonly questionId = `hub-people-q-${next}`;
  protected readonly maxName = MAX_NAME;
  protected readonly maxLine = MAX_LINE;
  protected readonly step = signal<1 | 2>(1);
  protected readonly busy = signal<Action | null>(null);
  private last: Action = 'next';
  private keys = 0;

  protected readonly rows = signal<readonly PersonRow[]>(
    (sectionContent(this.hub, 'People')?.people ?? []).map((p) =>
      this.row(p, p.profileId ? 'Member' : this.guestDescription(p.line)),
    ),
  );
  /** The people as the hub will show them, for the review. */
  protected readonly review = signal<HubPersonDto[]>([]);
  /** Messages the server gave for the people, such as "Choose a member from the search." */
  protected readonly peopleErrors = computed(() =>
    Object.entries(this.saver.errors())
      .filter(([path]) => path.startsWith('people'))
      .map(([, message]) => message),
  );
  protected readonly limitError = signal('');

  // Adding a member.
  protected readonly picked = new FormControl<PersonOption[]>([], { nonNullable: true });
  protected readonly options = signal<PersonOption[]>([]);
  protected readonly searching = signal(false);
  private found = new Map<string, PersonSummary>();

  // Adding a guest.
  protected readonly addingGuest = signal(false);
  protected readonly guest = this.fb.group({
    name: [''],
    line: [''],
    role: this.fb.control<HubPersonRole>('Mentor'),
  });
  protected readonly nameError = signal('');
  protected readonly lineError = signal('');

  constructor() {
    this.picked.valueChanges.pipe(takeUntilDestroyed()).subscribe((chosen) => {
      const person = chosen[0];
      if (!person) return;
      this.picked.setValue([], { emitEvent: false });
      this.options.set([]);
      this.addMember(person);
    });
  }

  /** Add a member (L2-161 AC2): members of the organisation by name, with their photo. */
  protected async search(q: string): Promise<void> {
    if (!q.trim()) {
      this.options.set([]);
      return;
    }
    this.searching.set(true);
    try {
      const page = await firstValueFrom(this.directory.search(q));
      const added = new Set(this.rows().map((r) => r.profileId));
      const members = page.items.filter((m) => !added.has(m.id));
      this.found = new Map(members.map((m) => [m.id, m]));
      this.options.set(members.map((m) => ({ id: m.id, name: m.name, detail: this.detail(m) })));
    } catch {
      this.options.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  private addMember(person: PersonOption): void {
    if (!this.roomForOneMore()) return;
    const member = this.found.get(person.id);
    const description = ['Member', person.detail].filter(Boolean).join(' · ');
    this.rows.update((rows) => [
      ...rows,
      this.row(
        {
          profileId: person.id,
          name: person.name,
          line: null,
          role: 'Mentor',
          photoUrl: member?.photoUrl ?? null,
        },
        description,
      ),
    ]);
  }

  protected startGuest(): void {
    this.guest.reset();
    this.nameError.set('');
    this.lineError.set('');
    this.addingGuest.set(true);
  }

  protected cancelGuest(): void {
    this.addingGuest.set(false);
  }

  /** Add guest (L2-161 AC3): a name and an optional line, kept on the hub only. */
  protected addGuest(): void {
    const { name, line, role } = this.guest.getRawValue();
    const trimmed = name.trim();
    const about = line.trim();
    this.nameError.set(
      !trimmed
        ? 'Enter their name.'
        : trimmed.length > MAX_NAME
          ? `Use ${MAX_NAME} characters or fewer.`
          : '',
    );
    this.lineError.set(about.length > MAX_LINE ? `Use ${MAX_LINE} characters or fewer.` : '');
    if (this.nameError() || this.lineError() || !this.roomForOneMore()) return;
    this.rows.update((rows) => [
      ...rows,
      this.row(
        { profileId: null, name: trimmed, line: about || null, role, photoUrl: null },
        this.guestDescription(about || null),
      ),
    ]);
    this.addingGuest.set(false);
  }

  protected remove(key: string): void {
    this.rows.update((rows) => rows.filter((r) => r.key !== key));
    this.limitError.set('');
  }

  /** Next, Save and finish later, or Save: saves the people as shown, then moves on or closes. */
  protected async save(action: Action): Promise<void> {
    if (this.busy()) return;
    this.last = action;
    this.busy.set(action);
    const people: HubPersonInput[] = this.rows().map((r) =>
      r.profileId
        ? { profileId: r.profileId, name: null, line: null, role: r.role.value }
        : { profileId: null, name: r.name, line: r.line, role: r.role.value },
    );
    const saved = await this.saver.save({ people });
    this.busy.set(null);
    if (!saved) {
      if (!this.saver.failed()) this.step.set(1);
      return;
    }
    if (action === 'next') {
      this.review.set(
        this.rows().map((r) => ({
          profileId: r.profileId,
          name: r.name,
          line: r.line,
          role: r.role.value,
          photoUrl: r.photoUrl,
        })),
      );
      this.step.set(2);
    } else {
      this.ref.close(true);
    }
  }

  protected retry(): void {
    void this.save(this.last);
  }

  protected color(row: PersonRow): ReturnType<typeof avatarColorFor> {
    return avatarColorFor(row.profileId);
  }

  private roomForOneMore(): boolean {
    const full = this.rows().length >= MAX_PEOPLE;
    this.limitError.set(full ? `You can add up to ${MAX_PEOPLE} people.` : '');
    return !full;
  }

  private detail(member: PersonSummary): string {
    return [member.roles.map((r) => r.name).join(', '), member.chapterName]
      .filter(Boolean)
      .join(' · ');
  }

  private guestDescription(line: string | null): string {
    return ['Guest', line].filter(Boolean).join(' · ');
  }

  private row(person: HubPersonDto, description: string): PersonRow {
    return {
      key: `person-${++this.keys}`,
      profileId: person.profileId,
      name: person.name,
      line: person.line,
      photoUrl: person.photoUrl,
      description,
      role: new FormControl<HubPersonRole>(person.role, { nonNullable: true }),
    };
  }
}
