import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { AlertComponent } from '../alert/alert.component';

/**
 * A self-hosted video with the browser's own controls, a poster, a default captions track and a
 * transcript (docs/design-system/components/video-player.html). It never autoplays. When the file
 * cannot play it shows the poster with a message and opens the transcript.
 */
@Component({
  selector: 'ft-video-player',
  imports: [AlertComponent],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayerComponent {
  readonly src = input.required<string>();
  readonly type = input('video/webm');
  readonly poster = input.required<string>();
  /** Alt text for the poster when it stands in for a video that cannot play. */
  readonly posterAlt = input.required<string>();
  /** WebVTT captions, shown by default. */
  readonly captions = input.required<string>();
  readonly captionsLanguage = input('en');
  readonly captionsLabel = input('English');
  /** Accessible name of the video, including its length. */
  readonly label = input.required<string>();
  /** The line under the video. */
  readonly caption = input<string | null>(null);
  /** The narration as text, behind "Read the transcript". */
  readonly transcript = input.required<string>();

  protected readonly unavailable = signal(false);
}
