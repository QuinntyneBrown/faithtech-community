import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WorkspaceDto } from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  TabComponent,
  TabsComponent,
} from '@faithtech-community/components';

export type WorkspaceSection = 'board' | 'backlog' | 'poker' | 'settings';

/**
 * What every workspace page shares (docs/mocks/pages/team-board, backlog, planning-poker, workspace-settings):
 * the breadcrumb, the workspace name as the page heading, the section tabs and, for Staff, the read-only note.
 * Settings is offered only to those who manage the workspace. A workspace the caller may not see (404) shows
 * the not-a-member state instead. Project header buttons with `ftWorkspaceActions`.
 */
@Component({
  selector: 'ft-workspace-frame',
  imports: [
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    TabComponent,
    TabsComponent,
  ],
  templateUrl: './workspace-frame.component.html',
  styleUrl: './workspace-frame.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceFrameComponent {
  readonly workspaceId = input.required<string>();
  /** Null while loading or after a failed load. */
  readonly workspace = input<WorkspaceDto | null>(null);
  readonly section = input.required<WorkspaceSection>();
  readonly subtitle = input<string | null>(null);
  /** The workspace does not exist or the caller is not allowed to see it (L2-031 AC6). */
  readonly notFound = input(false);
}
