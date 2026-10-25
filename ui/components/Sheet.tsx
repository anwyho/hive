import { h, type ComponentChildren } from "../../vendor/preact.module.js";
import { useEffect } from "../../vendor/hooks.module.js";
import { Icon } from "./Icon.js";

interface Props {
  title: string;
  onClose?: () => void;
  class?: string;
  children: ComponentChildren;
}

/* A modal card over a scrim. Escape and a scrim tap close it when it can be
   closed at all. */
export function Sheet({ title, onClose, class: extra = "", children }: Props) {
  useEffect(() => {
    if (!onClose) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div
      class="scrim"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        class={`sheet ${extra}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header class="sheet-head">
          <h2>{title}</h2>
          {onClose ? (
            <button class="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}
