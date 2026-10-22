import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
} from '@angular/core';
import qrcode from 'qrcode-generator';

export type QrCodeSize = 'sm' | 'md' | 'lg';

/** Modules of quiet zone around the code in the downloaded image (the plate's padding on screen). */
const QUIET_ZONE = 4;
const IMAGE_SIZE = 1024;

/**
 * A QR code for `value`, drawn dark on a light plate in both themes (design system: QR code).
 * `alt` is required: it names what the code opens, never "QR code image". The component encodes the
 * value itself (error correction M). `busy` fades the plate while a new code is made.
 */
@Component({
  selector: 'ft-qr-code',
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCodeComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly value = input.required<string>();
  readonly alt = input.required<string>();
  readonly size = input<QrCodeSize>('md');
  readonly caption = input<string | null>(null);
  readonly busy = input(false);

  /** The dark modules, row by row. */
  protected readonly matrix = computed(() => {
    const code = qrcode(0, 'M');
    code.addData(this.value(), 'Byte');
    code.make();
    const count = code.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => code.isDark(row, col)),
    );
  });

  protected readonly count = computed(() => this.matrix().length);

  /** One path of horizontal runs, so the code is a single crisp shape. */
  protected readonly path = computed(() => {
    const parts: string[] = [];
    this.matrix().forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (!row[x]) continue;
        const start = x;
        while (x < row.length && row[x]) x++;
        parts.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
      }
    });
    return parts.join('');
  });

  /** Saves the code as a PNG with its quiet zone, in the code-plate and code-module colours. */
  async downloadPng(fileName: string): Promise<void> {
    const style = getComputedStyle(this.host.nativeElement);
    const plate = style.getPropertyValue('--color-code-plate').trim();
    const module = style.getPropertyValue('--color-code-module').trim();
    const matrix = this.matrix();
    const cell = Math.floor(IMAGE_SIZE / (matrix.length + 2 * QUIET_ZONE));
    const side = cell * (matrix.length + 2 * QUIET_ZONE);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = plate;
    context.fillRect(0, 0, side, side);
    context.fillStyle = module;
    matrix.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) context.fillRect((x + QUIET_ZONE) * cell, (y + QUIET_ZONE) * cell, cell, cell);
      }),
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
