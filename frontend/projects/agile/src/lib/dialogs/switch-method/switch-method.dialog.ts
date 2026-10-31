import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  OrganisationNames,
  WorkspaceDto,
  WorkspaceMethod,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  RadioComponent,
  RadioGroupComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface SwitchMethodData {
  workspace: WorkspaceDto;
  /** The sprint a switch to Kanban closes, if one is running. */
  activeSprintName: string | null;
}

/**
 * Switch a workspace between Scrum and Kanban after saying what happens to sprints and stories (L2-036),
 * matching docs/mocks/dialogs/switch-method (default and to-scrum). Closes with the new method.
 */
@Component({
  selector: 'ft-switch-method-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    RadioComponent,
    RadioGroupComponent,
  ],
  templateUrl: './switch-method.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwitchMethodDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<WorkspaceMethod>>(DialogRef);
  protected readonly data = inject<SwitchMethodData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly method = new FormControl<WorkspaceMethod>(
    this.data.workspace.method === 'Scrum' ? 'Kanban' : 'Scrum',
    { nonNullable: true },
  );
  protected readonly target = toSignal(this.method.valueChanges, {
    initialValue: this.method.value,
  });
  protected readonly unchanged = computed(() => this.target() === this.data.workspace.method);
  protected readonly description = computed(() => {
    if (this.target() === 'Kanban') {
      const sprint = this.data.activeSprintName;
      return sprint
        ? `Items keep their status. Switching to Kanban closes ${sprint}, and its unfinished stories return to the backlog.`
        : 'Items keep their status. Kanban has no sprints: the board shows every story.';
    }
    return 'Items keep their status. Every story that isn’t Done goes to the backlog, ready for you to plan the first sprint.';
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async switch(): Promise<void> {
    if (this.busy() || this.unchanged()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.agile.switchMethod(this.data.workspace.id, this.target()));
      this.ref.close(this.target());
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
