import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Ao focar de novo (ex.: D-pad), coloca o cursor no fim do texto em vez do início. */
export function moveCaretToEndOnFocus(e: { target: HTMLInputElement }): void {
  const el = e.target;
  const len = el.value.length;
  queueMicrotask(() => {
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* type="email" etc. podem falhar */
    }
  });
}
