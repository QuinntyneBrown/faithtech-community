import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Children in a wrapping, vertically centred row. `between` pushes the ends apart. */
@Component({
  selector: 'ft-cluster',
  templateUrl: './cluster.component.html',
  styleUrl: './cluster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ft-cluster--between]': 'between()',
    '[style.--ft-cluster-gap]': '"var(--space-" + gap() + ")"',
  },
})
export class ClusterComponent {
  readonly between = input(false);
  readonly gap = input('3');
}
