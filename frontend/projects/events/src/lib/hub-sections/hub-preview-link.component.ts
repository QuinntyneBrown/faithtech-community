import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonComponent, IconComponent } from '@faithtech-community/components';

/**
 * The Preview link at the top of every hub wizard (L2-163 AC4, docs/mocks/dialogs/hub-*): opens the hub page in a new tab,
 * so the wizard stays open with its input. The page shows what is saved (ADR 0039).
 */
@Component({
  selector: 'ft-hub-preview-link',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './hub-preview-link.component.html',
  styleUrl: './hub-preview-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPreviewLinkComponent {
  readonly eventId = input.required<string>();
}
