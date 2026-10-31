import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  hasAny,
  ORGANISATION_SERVICE,
  OrganisationDto,
  SITE_SERVICE,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { EditGeneralSettingsDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';

/**
 * The General tab (L2-147), matching docs/mocks/pages/organisation-general: the name, the short name and whether
 * chapters are on. Holders of ManageOrganisationSettings edit them; anyone else here reads them (L2-147 AC2).
 */
@Component({
  selector: 'ft-general-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    LinkComponent,
    StackComponent,
  ],
  templateUrl: './general.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPage {
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly site = inject(SITE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly organisation = signal<OrganisationDto | null>(null);
  /** ManageOrganisationSettings governs General; AdministerOrganisation holds every capability. */
  protected readonly canEdit = computed(() =>
    hasAny(this.auth.capabilities(), 'ManageOrganisationSettings'),
  );
  /** The audit log is the administrators' (L2-040). */
  protected readonly canReadAudit = computed(() =>
    this.auth.capabilities().includes('AdministerOrganisation'),
  );
  protected readonly chapters = computed(() => {
    const label = this.organisation()?.chapterLabel;
    return label ? `On, called ${label.singular} / ${label.plural}` : 'Off';
  });

  constructor() {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected edit(): void {
    const organisation = this.organisation();
    if (!organisation) return;
    const ref = this.dialogs.open<boolean>(EditGeneralSettingsDialog, { data: organisation });
    ref.closed.subscribe((saved) => {
      if (saved) void this.saved();
    });
  }

  /** The new names reach this page, the shell and every title at once (L2-134). */
  private async saved(): Promise<void> {
    this.toasts.show({ variant: 'success', heading: 'Settings saved' });
    await Promise.all([
      this.load(),
      firstValueFrom(this.auth.loadCurrentUser()).catch(() => null),
      this.site.load(),
    ]);
  }

  private async load(): Promise<void> {
    if (!this.organisation()) this.state.set('loading');
    try {
      this.organisation.set(await firstValueFrom(this.organisations.get()));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
