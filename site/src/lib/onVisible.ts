/** Runs init once per matching element, the first time it scrolls into view. */
export function onVisible(selector: string, init: (el: HTMLElement) => void) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      init(e.target as HTMLElement);
    }
  });
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => io.observe(el));
}
