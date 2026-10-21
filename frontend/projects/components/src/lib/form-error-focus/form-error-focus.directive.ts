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
