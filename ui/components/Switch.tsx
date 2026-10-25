import { h, type ComponentChildren } from "../../vendor/preact.module.js";

interface Props {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  detail?: string;
  children?: ComponentChildren;
}

export function Switch({ checked, onChange, label, detail, children }: Props) {
  return (
    <button
      class="switch"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      {children}
      <span class="switch-text">
        <span class="switch-label">{label}</span>
        {detail ? <span class="switch-detail">{detail}</span> : null}
      </span>
      <span class="switch-track" aria-hidden="true">
        <span class="switch-thumb" />
      </span>
    </button>
  );
}
