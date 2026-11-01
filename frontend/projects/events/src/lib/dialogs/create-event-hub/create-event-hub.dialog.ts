import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  HubSectionKind,
  HubTemplateDto,
  PastEventHubDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogComponent,
  EmptyStateComponent,
  formatDay,
  FormFieldComponent,
  IconComponent,
  ListSkeletonComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  StepperComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { HUB_SECTIONS } from '../../hub-sections';

export interface CreateEventHubData {
  eventId: string;
  title: string;
  /** As the event page shows them: the hub reads them from the event and stores none (L2-153 AC3). */
  when: string;
  where: string;
  rsvpLink: string;
}

/** How the wizard ended: whether a hub exists now, and whether the lead chose to fill it in. */
export interface CreateEventHubResult {
  created: boolean;
  next: 'fill-in' | 'later' | 'closed';
}

const STEPS = ['Event', 'Starting point', 'Sections', 'Done'] as const;

/** Step 2's built-in starting points beside the organisation's templates (L2-169 AC1). */
const BLANK = 'blank';
const COPY = 'copy';

/**
 * The Create event hub wizard (L2-153), matching docs/mocks/dialogs/create-event-hub: four steps over ft-stepper, one
 * question each, with Save and finish later on every step. Step 1's Next creates the Draft hub; step 2 applies the
 * starting point, a template or Blank, replacing the sections (L2-169 AC3, ADR 0041), and step 3 starts ticked as it
 * left them; every later Next and Save and finish later saves which sections are shown (save as you go).
 */
@Component({
  selector: 'ft-create-event-hub-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    DialogComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    ListSkeletonComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    StepperComponent,
    TextFieldComponent,
  ],
  templateUrl: './create-event-hub.dialog.html',
  styleUrl: './create-event-hub.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEventHubDialog {
  protected readonly ref = inject<DialogRef<CreateEventHubResult>>(DialogRef);
  protected readonly data = inject<CreateEventHubData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly steps = STEPS;
  protected readonly blank = BLANK;
  protected readonly copy = COPY;
  /** The organisation's templates (L2-169 AC1); Blank and Copy stay when they fail to load (AC6). */
  protected readonly templates = signal<HubTemplateDto[]>([]);
  protected readonly templatesFailed = signal(false);
  /** Copy a past hub's list (L2-170 AC2): null until it loads. */
  protected readonly pastHubs = signal<PastEventHubDto[] | null>(null);
  protected readonly pastHubsFailed = signal(false);
  /** Whether the organisation has any other hub, so an empty list without a search says there are none (AC2). */
  protected readonly anyPastHubs = signal(true);
  protected readonly copySearch = new FormControl('', { nonNullable: true });
  protected readonly copyFrom = new FormControl('', { nonNullable: true });
  protected readonly copyError = signal('');
  /** Who ticked step 3, for its hint: a template's name, the copied hub, or null after Blank (L2-169 AC4, L2-170 AC4). */
  protected readonly tickedFor = signal<string | null>(null);
  protected readonly sections = HUB_SECTIONS;
  protected readonly statusId = `create-event-hub-step-${this.data.eventId}`;

  protected readonly step = signal(1);
  protected readonly busy = signal<'next' | 'later' | null>(null);
  protected readonly failed = signal(false);
  protected readonly refusal = signal<string | null>(null);
  private readonly created = signal(false);
  /** What to retry after a failure. */
  private lastAction: 'next' | 'later' = 'next';

  protected readonly startingPoint = new FormControl(BLANK, { nonNullable: true });
  protected readonly shown = new FormControl<readonly string[]>(
    HUB_SECTIONS.map((s) => s.kind),
    { nonNullable: true },
  );

  constructor() {
    void this.loadTemplates();
    const destroyed = inject(DestroyRef);
    this.startingPoint.valueChanges.pipe(takeUntilDestroyed(destroyed)).subscribe((choice) => {
      this.copyError.set('');
      if (choice === COPY && this.pastHubs() === null) void this.loadPastHubs();
    });
    this.copySearch.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(destroyed))
      .subscribe(() => void this.loadPastHubs());
    this.copyFrom.valueChanges
      .pipe(takeUntilDestroyed(destroyed))
      .subscribe(() => this.copyError.set(''));
  }

  protected async loadPastHubs(): Promise<void> {
    const search = this.copySearch.value.trim();
    this.pastHubsFailed.set(false);
    this.pastHubs.set(null);
    try {
      const hubs = await firstValueFrom(this.hubs.pastHubs(search, this.data.eventId));
      if (search !== this.copySearch.value.trim()) return;
      if (!search) this.anyPastHubs.set(hubs.length > 0);
      this.pastHubs.set(hubs);
    } catch {
      this.pastHubsFailed.set(true);
    }
  }

  /** "Sat 24 Oct 2026", as each hub to copy reads its date. */
  protected pastHubDate(hub: PastEventHubDto): string {
    return `${formatDay(hub.startsAt)} ${new Date(hub.startsAt).getFullYear()}`;
  }

  protected async loadTemplates(): Promise<void> {
    this.templatesFailed.set(false);
    try {
      this.templates.set(await firstValueFrom(this.hubs.templates()));
    } catch {
      this.templatesFailed.set(true);
    }
  }

  protected back(): void {
    this.clearErrors();
    this.step.update((s) => Math.max(1, s - 1));
  }

  protected next(): Promise<void> {
    return this.run('next');
  }

  protected later(): Promise<void> {
    return this.run('later');
  }

  protected retry(): Promise<void> {
    return this.run(this.lastAction);
  }

  protected fillIn(): void {
    this.ref.close({ created: true, next: 'fill-in' });
  }

  protected close(): void {
    this.ref.close({ created: this.created(), next: 'closed' });
  }

  private async run(action: 'next' | 'later'): Promise<void> {
    if (this.busy()) return;
    // L2-170 AC5: Copy needs a hub chosen before anything is saved.
    if (this.step() === 2 && this.startingPoint.value === COPY && !this.copyFrom.value) {
      this.copyError.set('Choose a hub to copy.');
      return;
    }
    this.lastAction = action;
    this.clearErrors();
    this.busy.set(action);
    try {
      if (!this.created()) {
        await firstValueFrom(this.hubs.create(this.data.eventId));
        this.created.set(true);
      }
      if (this.step() === 2) await this.start();
      else if (this.step() > 2) await this.save();
      if (action === 'later') {
        this.ref.close({ created: true, next: 'later' });
      } else {
        this.step.update((s) => s + 1);
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 409)) {
        this.refusal.set(refusalOf(error));
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(null);
    }
  }

  /** Applies step 2's choice and ticks step 3 as the hub now shows its sections (L2-169 AC3, AC4). */
  private async start(): Promise<void> {
    const choice = this.startingPoint.value;
    const template = this.templates().find((t) => t.id === choice);
    const copying = choice === COPY;
    const request = template
      ? { templateId: template.id }
      : copying
        ? { copyFromEventId: this.copyFrom.value }
        : {};
    const hub: EventHubDto = await firstValueFrom(this.hubs.start(this.data.eventId, request));
    this.shown.setValue(hub.sections.filter((s) => s.visible).map((s) => s.kind));
    this.tickedFor.set(template?.name ?? (copying ? 'the hub you copied' : null));
  }

  /** Step 3's hint, naming who ticked the sections. */
  protected sectionsHint(): string {
    const hint = 'Untick anything you don’t need. You can change this later.';
    const by = this.tickedFor();
    return by ? `Ticked for ${by}. ${hint}` : hint;
  }

  private save(): Promise<void> {
    const shown = this.shown.value;
    return firstValueFrom(
      this.hubs.save(this.data.eventId, {
        sections: HUB_SECTIONS.map((s) => ({
          kind: s.kind as HubSectionKind,
          visible: shown.includes(s.kind),
        })),
      }),
    );
  }

  private clearErrors(): void {
    this.failed.set(false);
    this.refusal.set(null);
  }
}

/** The 409's detail, or the first field error of a 400. */
function refusalOf(error: HttpErrorResponse): string {
  const problem = problemDetails(error);
  const firstError = Object.values(problem?.errors ?? {})[0]?.[0];
  return problem?.detail ?? firstError ?? 'We couldn’t save your hub.';
}
