import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AGILE_SERVICE, WorkspaceDto, WorkspaceMemberDto } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface RemoveWorkspaceMemberData {
  workspace: WorkspaceDto;
  member: WorkspaceMemberDto;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Confirms removing a member, who loses access at once and whose items become unassigned (L2-031 AC8),
 * matching docs/mocks/dialogs/remove-workspace-member. Closes with true once removed.
 */
@Component({
  selector: 'ft-remove-workspace-member-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './remove-workspace-member.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveWorkspaceMemberDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<RemoveWorkspaceMemberData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  /** "Ruth Alvarez loses access straight away. Their 2 stories and 3 tasks become unassigned." */
  protected readonly description = (() => {
    const { name, assignedStories, assignedTasks } = this.data.member;
    const items = [
      assignedStories ? count(assignedStories, 'story', 'stories') : '',
      assignedTasks ? count(assignedTasks, 'task', 'tasks') : '',
    ].filter(Boolean);
    const unassigned = items.length ? ` Their ${items.join(' and ')} become unassigned.` : '';
    return `${name} loses access straight away.${unassigned}`;
  })();

  protected async remove(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(
        this.agile.removeMember(this.data.workspace.id, this.data.member.profileId),
      );
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
