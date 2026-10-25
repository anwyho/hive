import { h } from "../../vendor/preact.module.js";
import { LEVELS, type Level } from "../../hive/ai/index.js";
import type { Opponent } from "../players.js";

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

function Segmented<T extends string>(props: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === props.value}
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

const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

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
          <span class="opponent-label">Difficulty</span>
          <Segmented
            label="Difficulty"
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_NAMES[l] }))}
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
