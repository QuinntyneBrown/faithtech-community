import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@faithtech-community/components';

/** The workspaces a member may see (L2-050), matching docs/mocks/pages/workspaces. */
@Component({
  selector: 'ft-workspaces-page',
  imports: [PageHeaderComponent],
  templateUrl: './workspaces.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacesPage {}
