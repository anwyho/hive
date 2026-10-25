import { h } from "../../vendor/preact.module.js";
import { parsePieceId, type Expansions } from "../../hive/index.js";
import { Switch } from "./Switch.js";
import { TileIcon } from "./Tile.js";

const EXPANSIONS: readonly {
  key: keyof Expansions;
  label: string;
  piece: string;
  detail: string;
}[] = [
  {
    key: "mosquito",
    label: "Mosquito",
    piece: "wM",
    detail: "Copies the moves of the bugs it touches",
  },
  {
    key: "ladybug",
    label: "Ladybug",
    piece: "wL",
    detail: "Two steps over the hive, one step down",
  },
  {
    key: "pillbug",
    label: "Pillbug",
    piece: "wP",
    detail: "Can lift a neighbour over itself",
  },
];

export function expansionSummary(expansions: Expansions): string {
  const on = EXPANSIONS.filter((x) => expansions[x.key]).map((x) => x.label);
  return on.length === 0 ? "Base game" : on.join(", ");
}

/* Collapsed by default: most games are the same set as last time, and the
   summary says which. */
export function ExpansionPicker({
  value,
  onChange,
}: {
  value: Expansions;
  onChange(next: Expansions): void;
}) {
  return (
    <details class="expansions">
      <summary>
        <span class="expansions-title">Expansions</span>
        <span class="expansions-summary">{expansionSummary(value)}</span>
      </summary>
      {EXPANSIONS.map((x) => (
        <Switch
          key={x.key}
          checked={value[x.key]}
          label={x.label}
          detail={x.detail}
          onChange={(on) => onChange({ ...value, [x.key]: on })}
        >
          <TileIcon piece={parsePieceId(x.piece)} label="" />
        </Switch>
      ))}
    </details>
  );
}
