import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * A private note: text on a subtle block with an accent rule and a date line.
 * While `loading` it renders a note-shaped skeleton (two lines and a date) and is aria-hidden;
 * label the loading container with aria-busy="true" and an aria-label such as "Loading notes".
 */
@Component({
  selector: 'ft-note',
  imports: [SkeletonComponent],
  templateUrl: './note.component.html',
  styleUrl: './note.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ft-note--skeleton]': 'loading()',
    '[attr.aria-hidden]': 'loading() ? "true" : null',
  },
})
export class NoteComponent {
  /** Display date such as "Thu 16 Oct". */
  readonly date = input<string | null>(null);
  /** Shows a note-shaped skeleton instead of the content. */
  readonly loading = input(false);
}
