import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  BacklogNodeDto,
  PokerSessionDto,
  ROLE_LABELS,
  WorkspaceDto,
  WorkspaceMemberDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  FormErrorFocusDirective,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { points } from '../../work-item-labels';

const GENERIC_FAILURE = 'We couldn’t reach FaithTech. Nothing was changed — try again.';

export interface StartPokerData {
  workspace: WorkspaceDto;
  /** Stories that are not Done, in backlog order. */
  stories: BacklogNodeDto[];
}

/**
 * Start a Planning Poker session (L2-038 AC1): the stories to estimate one at a time and the members to invite,
 * matching docs/mocks/dialogs/start-poker. Closes with the new session.
 */
@Component({
  selector: 'ft-start-poker-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    FormErrorFocusDirective,
    StackComponent,
  ],
  templateUrl: './start-poker.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartPokerDialog {
  protected readonly ref = inject<DialogRef<PokerSessionDto>>(DialogRef);
  protected readonly data = inject<StartPokerData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly form = inject(NonNullableFormBuilder).group({
    storyIds: [[] as string[]],
    invitedIds: [[] as string[]],
  });
  /** Everyone but the caller, who facilitates. */
  protected readonly members = this.data.workspace.members.filter((m) => !m.isYou);
  protected readonly storyError = signal('');
  protected readonly inviteError = signal('');
  protected readonly busy = signal(false);
  /** The failure alert's text, or null when the last attempt did not fail. */
  protected readonly failed = signal<string | null>(null);

  protected estimate(story: BacklogNodeDto): string {
    return story.storyPoints === null ? 'Not estimated' : points(story.storyPoints);
  }

  protected roles(member: WorkspaceMemberDto): string {
    return member.roles.map((r) => ROLE_LABELS[r]).join(', ');
  }

  protected async start(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    const storyIds = this.data.stories.map((s) => s.id).filter((id) => value.storyIds.includes(id));
    this.storyError.set(storyIds.length ? '' : 'Choose at least one story to estimate.');
    this.inviteError.set('');
    if (this.storyError()) {
      this.errorFocus().focusFirstError();
      return;
    }
    this.busy.set(true);
    this.failed.set(null);
    try {
      const invitedIds = this.members
        .map((m) => m.profileId)
        .filter((id) => value.invitedIds.includes(id));
      this.ref.close(
        await firstValueFrom(
          this.agile.startPokerSession(this.data.workspace.id, { storyIds, invitedIds }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors;
        this.storyError.set(errors?.['StoryIds']?.[0] ?? '');
        this.inviteError.set(errors?.['InvitedIds']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else if (error instanceof HttpErrorResponse && error.status === 409) {
        // Someone else started a session first (L2-038, ADR 0012).
        this.failed.set(problemDetails(error)?.detail ?? GENERIC_FAILURE);
      } else {
        this.failed.set(GENERIC_FAILURE);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
