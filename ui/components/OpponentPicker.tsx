import { h } from "../../vendor/preact.module.js";
import { LEVELS, LEVEL_SPECS } from "../../hive/ai/index.js";
import type { Opponent } from "../players.js";

interface Option<T extends string | number> {
  readonly value: T;
  readonly label: string;
  readonly name?: string;
}

function Segmented<T extends string | number>(props: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange(value: T): void;
  class?: string;
}) {
  return (
    <div
      class={`segmented ${props.class ?? ""}`}
      role="radiogroup"
      aria-label={props.label}
    >
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          aria-label={o.name}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const KINDS: readonly Option<Opponent["kind"]>[] = [
  { value: "human", label: "Human" },
  { value: "computer", label: "Computer" },
];

const LEVEL_OPTIONS = LEVELS.map((l) => ({
  value: l,
  label: String(l),
  name: `Level ${l}, ${LEVEL_SPECS[l].name}`,
}));

const SIDES: readonly Option<Opponent["side"]>[] = [
  { value: "w", label: "White" },
  { value: "b", label: "Black" },
  { value: "random", label: "Random" },
];

export function OpponentPicker({
  value,
  onChange,
}: {
  value: Opponent;
  onChange(next: Opponent): void;
}) {
  return (
    <div class="opponent">
      <Segmented
        label="Opponent"
        options={KINDS}
        value={value.kind}
        onChange={(kind) => onChange({ ...value, kind })}
      />
      {value.kind === "computer" ? (
        <div class="opponent-rows">
          <span class="opponent-label">
            Level{" "}
            <span class="opponent-level">
              {value.level} · {LEVEL_SPECS[value.level].name}
            </span>
          </span>
          <Segmented
            label="Level"
            class="segmented-levels"
            options={LEVEL_OPTIONS}
            value={value.level}
            onChange={(level) => onChange({ ...value, level })}
          />
          <span class="opponent-label">You play</span>
          <Segmented
            label="You play"
            options={SIDES}
            value={value.side}
            onChange={(side) => onChange({ ...value, side })}
          />
        </div>
      ) : null}
    </div>
  );
}
