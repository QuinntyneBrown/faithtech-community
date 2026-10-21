import { Directive, ElementRef, Injector, afterNextRender, inject } from '@angular/core';

/**
 * Put on a form. After a submit it moves focus to the error summary when one
 * is shown, otherwise to the first control marked aria-invalid.
 */
@Directive({
  selector: '[ftFormErrorFocus]',
  host: { '(submit)': 'onSubmit()' },
})
export class FormErrorFocusDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected onSubmit(): void {
    this.focusFirstError();
  }

  /** Focuses the error summary, or the first invalid control, after the next render. Call it when
   * errors arrive later than the submit, such as from a server response. */
  focusFirstError(): void {
    afterNextRender(
      () => {
        const target =
          this.el.querySelector<HTMLElement>('[role="alert"][tabindex="-1"]') ??
          this.el.querySelector<HTMLElement>('[aria-invalid="true"]');
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
