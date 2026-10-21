import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CardComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  ThemePreference,
  ThemeService,
} from '@faithtech-community/components';

/**
 * Settings (mock `pages/settings`). Appearance applies the chosen theme at once and remembers it
 * on this device (L2-045 AC6). The account and email cards join when their designs are built.
 */
@Component({
  selector: 'ft-settings-page',
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly theme = inject(ThemeService);

  protected readonly preference = this.theme.preference;

  protected choose(preference: ThemePreference): void {
    this.theme.set(preference);
  }
}
