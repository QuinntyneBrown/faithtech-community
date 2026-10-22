import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  SkeletonComponent,
  StackComponent,
  SwitchComponent,
  ThemePreference,
  ThemeService,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

/**
 * Settings (mock `pages/settings`). Appearance applies the chosen theme at once and remembers it on
 * this device (L2-045 AC6). "Email me when" holds the announcement email switch, which saves as soon
 * as it changes (L2-030 AC2, L2-052 AC4). The mock's Account section belongs to account settings
 * (L2-052) and is not built yet (ADR 0016).
 */
@Component({
  selector: 'ft-settings-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RadioComponent,
    RadioGroupComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StackComponent,
    SwitchComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly theme = inject(ThemeService);

  protected readonly preference = this.theme.preference;

  protected readonly state = signal<State>('loading');
  /** On means announcement emails arrive: the opposite of the stored opt-out. */
  protected readonly announcementEmails = new FormControl(true, { nonNullable: true });

  constructor() {
    this.announcementEmails.valueChanges.subscribe((on) => void this.save(on));
    void this.load();
  }

  protected choose(preference: ThemePreference): void {
    this.theme.set(preference);
  }

  protected retry(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const optedOut = await firstValueFrom(this.announcements.emailOptOut());
      this.announcementEmails.setValue(!optedOut, { emitEvent: false });
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private async save(on: boolean): Promise<void> {
    try {
      await firstValueFrom(this.announcements.setEmailOptOut(!on));
      this.toasts.show({
        variant: 'success',
        heading: 'Settings saved',
        text: on
          ? 'Announcements will reach you by email too.'
          : 'You’ll see announcements in the app only.',
      });
    } catch {
      this.announcementEmails.setValue(!on, { emitEvent: false });
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t save your settings',
        text: 'Nothing was changed — try again.',
      });
    }
  }
}
