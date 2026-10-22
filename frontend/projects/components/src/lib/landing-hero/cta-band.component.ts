import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/** The marketing page's closing call to action: a named region with a heading, a line and one action. */
@Component({
  selector: 'ft-cta-band',
  templateUrl: './cta-band.component.html',
  styleUrl: './cta-band.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-labelledby]': 'headingId' },
})
export class CtaBandComponent {
  readonly heading = input.required<string>();
  readonly text = input<string | null>(null);

  protected readonly headingId = `ft-cta-band-${nextId++}`;
}
