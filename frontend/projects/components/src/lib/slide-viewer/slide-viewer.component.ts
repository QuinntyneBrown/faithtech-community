import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** One slide of a deck: the image (or PDF) URL, its thumbnail, its title and its kind. */
export interface SlideViewerSlide {
  src: string;
  thumbnailSrc: string;
  /** The resource's title: the slide image's alt ("Slide 3: " + title) and the status line. */
  title: string;
  /** A `'pdf'` slide shows its first-page thumbnail and a link that opens the file in a new tab. */
  kind: 'image' | 'pdf';
}

/** The smallest horizontal travel, in CSS pixels, that counts as a swipe. */
const SWIPE_DISTANCE = 40;

/**
 * Shows a deck one slide at a time (design system, slide viewer): the WAI-ARIA carousel pattern without rotation.
 * Previous and Next, a polite "Slide n of m" status, and a strip of thumbnails that is one tab stop (roving) to jump
 * to any slide. ArrowLeft, ArrowRight, Home and End move on the viewer; a horizontal swipe on the stage moves one
 * slide. A PDF slide shows its thumbnail and a link (`pdfLabel`) that opens it; a deck of one slide (such as one
 * PDF) leaves out the bar and the thumbnails. It never advances by itself and makes no HTTP calls.
 */
@Component({
  selector: 'ft-slide-viewer',
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  templateUrl: './slide-viewer.component.html',
  styleUrl: './slide-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ft-slide-viewer',
    role: 'region',
    '[class.ft-slide-viewer--file]': 'slide()?.kind === "pdf"',
    '[attr.aria-roledescription]': 'multiple() ? "carousel" : null',
    '[attr.aria-label]': 'label()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.tabindex]': 'multiple() ? 0 : null',
    '(keydown)': 'onKeydown($event)',
  },
})
export class SlideViewerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Accessible name of the region, such as "Slides". */
  readonly label = input.required<string>();
  /** The deck, in order. */
  readonly slides = input.required<SlideViewerSlide[]>();
  /** The current slide, zero-based; two-way bindable. */
  readonly index = model(0);
  /** The PDF link's text. */
  readonly pdfLabel = input('Open the slides (PDF)');
  /** A muted line beside the PDF link, such as "SoCal Hackathon slides · PDF · 18.4 MB". */
  readonly pdfMeta = input<string | null>(null);
  /** Id of the help line above the viewer ("Use the left and right arrow keys, or pick a thumbnail."). */
  readonly describedBy = input<string | null>(null);

  protected readonly count = computed(() => this.slides().length);
  protected readonly multiple = computed(() => this.count() > 1);
  protected readonly position = computed(() =>
    Math.min(Math.max(this.index(), 0), Math.max(this.count() - 1, 0)),
  );
  protected readonly slide = computed<SlideViewerSlide | undefined>(
    () => this.slides()[this.position()],
  );
  protected readonly stageSrc = computed(() => {
    const slide = this.slide();
    return slide ? (slide.kind === 'pdf' ? slide.thumbnailSrc : slide.src) : null;
  });
  protected readonly stageAlt = computed(() => {
    const slide = this.slide();
    if (!slide) return '';
    return slide.kind === 'pdf'
      ? `First page of ${slide.title}`
      : `Slide ${this.position() + 1}: ${slide.title}`;
  });
  /** The stage image's state, reset whenever the slide changes. */
  protected readonly imageState = linkedSignal<string | null, 'loading' | 'loaded' | 'failed'>({
    source: this.stageSrc,
    computation: () => 'loading',
  });
  /** The thumbnail that holds the strip's tab stop; follows the current slide. */
  protected readonly focusIndex = linkedSignal(() => this.position());

  private readonly previousButton = viewChild('previousButton', { read: ElementRef });
  private readonly nextButton = viewChild('nextButton', { read: ElementRef });
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly thumbs = viewChildren<ElementRef<HTMLButtonElement>>('thumb');

  private touchStart: { x: number; y: number } | null = null;

  constructor() {
    // Keep the current thumbnail in view by scrolling the strip only, never the page.
    afterRenderEffect(() => {
      const strip = this.strip()?.nativeElement;
      const thumb = this.thumbs()[this.position()]?.nativeElement;
      if (!strip || !thumb) return;
      const start = thumb.offsetLeft;
      const end = start + thumb.offsetWidth;
      if (start < strip.scrollLeft) strip.scrollTo?.({ left: start });
      else if (end > strip.scrollLeft + strip.clientWidth)
        strip.scrollTo?.({ left: end - strip.clientWidth });
    });
  }

  protected go(target: number): void {
    const last = this.count() - 1;
    const next = Math.min(Math.max(target, 0), Math.max(last, 0));
    if (next !== this.position()) this.index.set(next);
    // A button that becomes disabled while focused hands focus to the viewer.
    const focused = document.activeElement;
    const leaving =
      (next === 0 && this.previousButton()?.nativeElement.contains(focused)) ||
      (next === last && this.nextButton()?.nativeElement.contains(focused));
    if (leaving) this.host.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.multiple() || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = this.keyTarget(event.key, this.position());
    if (target === null) return;
    event.preventDefault();
    this.go(target);
  }

  protected onThumbKeydown(event: KeyboardEvent): void {
    const target = this.keyTarget(event.key, this.focusIndex());
    if (target === null) return;
    // The strip's arrows move focus, not the slide.
    event.preventDefault();
    event.stopPropagation();
    const next = Math.min(Math.max(target, 0), this.count() - 1);
    this.focusIndex.set(next);
    this.thumbs()[next]?.nativeElement.focus();
  }

  protected onTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const start = this.touchStart;
    const touch = event.changedTouches[0];
    this.touchStart = null;
    if (!start || !touch || !this.multiple()) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return;
    this.go(this.position() + (dx < 0 ? 1 : -1));
  }

  private keyTarget(key: string, from: number): number | null {
    switch (key) {
      case 'ArrowLeft':
        return from - 1;
      case 'ArrowRight':
        return from + 1;
      case 'Home':
        return 0;
      case 'End':
        return this.count() - 1;
      default:
        return null;
    }
  }
}
