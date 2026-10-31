import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  OrganisationNames,
  problemDetails,
  SprintCandidateDto,
  SprintsDto,
  WorkspaceDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  GridComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface StartSprintData {
  workspace: WorkspaceDto;
  sprints: SprintsDto;
}

/** "Sprint 8" after a "Sprint 7"; otherwise numbered by how many sprints there have been. */
function nextSprintName(sprints: SprintsDto): string {
  const all = [...sprints.history, ...(sprints.active ? [sprints.active] : [])];
  const numbers = all
    .map((s) => Number(/^Sprint (\d+)$/.exec(s.name)?.[1] ?? NaN))
    .filter((n) => n > 0);
  return `Sprint ${numbers.length ? Math.max(...numbers) + 1 : all.length + 1}`;
}

/** YYYY-MM-DD in local time. */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Start a sprint (L2-035 AC1, AC5, AC6): name, goal, dates and its stories, with the chosen points and the
 * recent average to plan by. Matches docs/mocks/dialogs/start-sprint. Closes with the sprint's name.
 */
@Component({
  selector: 'ft-start-sprint-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    GridComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './start-sprint.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartSprintDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly data = inject<StartSprintData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [nextSprintName(this.data.sprints)],
    goal: [''],
    startDate: [isoDay(new Date())],
    endDate: [isoDay(new Date(Date.now() + 13 * 24 * 60 * 60 * 1000))],
    storyIds: [[] as string[]],
  });
  private readonly chosen = toSignal(this.form.controls.storyIds.valueChanges, {
    initialValue: [] as string[],
  });
  protected readonly candidates = this.data.sprints.candidates;
  protected readonly chosenPoints = computed(() =>
    this.candidates
      .filter((c) => this.chosen().includes(c.id))
      .reduce((sum, c) => sum + (c.storyPoints ?? 0), 0),
  );
  protected readonly caption = (() => {
    const average = this.data.sprints.averageCompletedPoints;
    const recent =
      average === null ? '' : ` Recent sprints completed ${average} points on average.`;
    return `Only one sprint can be active at a time.${recent}`;
  })();

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected describe(candidate: SprintCandidateDto): string {
    const points =
      candidate.storyPoints === null ? 'Not estimated' : `${candidate.storyPoints} pts`;
    return candidate.returnedFrom ? `${points} · returned from ${candidate.returnedFrom}` : points;
  }

  protected error(field: string): string {
    return this.errors()[field] ?? '';
  }

  protected async start(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    const errors: Record<string, string> = {};
    if (!value.name.trim()) errors['Name'] = 'Give the sprint a name.';
    if (!value.goal.trim()) errors['Goal'] = 'Write a goal so the team knows what done looks like.';
    if (!value.startDate) errors['StartDate'] = 'Choose when the sprint starts.';
    if (!value.endDate || value.endDate <= value.startDate) {
      errors['EndDate'] = 'Choose an end date after the start date.';
    }
    if (!value.storyIds.length) errors['StoryIds'] = 'Choose at least one story.';
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      // Stories in the order the dialog lists them.
      const storyIds = this.candidates.map((c) => c.id).filter((id) => value.storyIds.includes(id));
      await firstValueFrom(
        this.agile.startSprint(this.data.workspace.id, {
          name: value.name.trim(),
          goal: value.goal.trim(),
          startDate: value.startDate,
          endDate: value.endDate,
          storyIds,
        }),
      );
      this.ref.close(value.name.trim());
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const server = problemDetails(error)?.errors ?? {};
        this.errors.set(Object.fromEntries(Object.entries(server).map(([k, v]) => [k, v[0]])));
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
