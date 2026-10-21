import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A private note: text on a subtle block with an accent rule and a date line. */
@Component({
  selector: 'ft-note',
  templateUrl: './note.component.html',
  styleUrl: './note.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteComponent {
  /** Display date such as "Thu 16 Oct". */
  readonly date = input<string | null>(null);
}
