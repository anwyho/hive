import { h } from "../../vendor/preact.module.js";
import { useState } from "../../vendor/hooks.module.js";
import {
  parsePieceId,
  type Expansions,
  type GameOptions,
} from "../../hive/index.js";
import { polygon } from "../geometry.js";
import { useInstallHint } from "../hooks/useInstallHint.js";
import { Help } from "./Help.js";
import { opponentOf, seatsFor, type SeatConfig } from "../players.js";
import { InstallHint } from "./InstallHint.js";
import { OpponentPicker } from "./OpponentPicker.js";
import { Switch } from "./Switch.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { TileBody, TileIcon } from "./Tile.js";
import { UpdateRow } from "./UpdateRow.js";

interface Props {
  initial: GameOptions;
  initialSeats: SeatConfig;
  canResume: boolean;
  onStart(options: GameOptions, seats: SeatConfig): void;
  onResume(): void;
  onImport(): void;
}

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

/* A loose cluster for the title: the base bugs as they might sit mid-game. */
const CLUSTER: readonly [string, number, number][] = [
  ["wQ", 0, 0],
  ["bB1", 1, 0],
  ["wG1", -1, 1],
  ["bS1", 0, 1],
  ["wA1", 1, -1],
  ["bQ", 2, -1],
];

export function NewGame({
  initial,
  initialSeats,
  canResume,
  onStart,
  onResume,
  onImport,
}: Props) {
  const [expansions, setExpansions] = useState<Expansions>(initial.expansions);
  const [tournament, setTournament] = useState(initial.tournamentOpening);
  const install = useInstallHint();
  const [help, setHelp] = useState(false);
  const [opponent, setOpponent] = useState(() => opponentOf(initialSeats));

  return (
    <div class="setup">
      <header class="setup-hero">
        <svg
          class="setup-cluster"
          viewBox="-100 -170 285 265"
          aria-hidden="true"
        >
          {CLUSTER.map(([piece, q, r]) => (
            <g
              key={piece}
              transform={`translate(${86.6 * (q + r / 2)} ${75 * r - 40})`}
            >
              <TileBody piece={parsePieceId(piece)} />
            </g>
          ))}
          <polygon
            class="setup-ghost"
            points={polygon(44)}
            transform={`translate(${86.6 * 1.5} ${75 - 40})`}
          />
        </svg>
        <h1>Hive</h1>
        <p>Two players, one screen. Surround the other queen to win.</p>
      </header>

      <section class="setup-card" aria-label="Game options">
        <h2>Opponent</h2>
        <OpponentPicker value={opponent} onChange={setOpponent} />
        <h2>Expansions</h2>
        {EXPANSIONS.map((x) => (
          <Switch
            key={x.key}
            checked={expansions[x.key]}
            label={x.label}
            detail={x.detail}
            onChange={(on) => setExpansions({ ...expansions, [x.key]: on })}
          >
            <TileIcon piece={parsePieceId(x.piece)} label="" />
          </Switch>
        ))}
        <h2>Rules</h2>
        <Switch
          checked={tournament}
          label="Tournament opening"
          detail="No queen on either player's first turn"
          onChange={setTournament}
        />
      </section>

      <div class="setup-actions">
        {canResume ? (
          <button class="btn btn-primary" onClick={onResume}>
            Resume game
          </button>
        ) : null}
        <button
          class={canResume ? "btn" : "btn btn-primary"}
          onClick={() =>
            onStart(
              { expansions, tournamentOpening: tournament },
              seatsFor(opponent, Math.random),
            )
          }
        >
          Start game
        </button>
        <button class="btn btn-quiet" onClick={() => setHelp(true)}>
          How to play
        </button>
        <button class="btn btn-quiet" onClick={onImport}>
          Import a game record
        </button>
      </div>

      {help ? <Help onClose={() => setHelp(false)} /> : null}

      <footer class="setup-foot">
        {install.shown ? <InstallHint onDismiss={install.dismiss} /> : null}
        <div class="actions">
          <ThemeToggle />
        </div>
        <UpdateRow />
      </footer>
    </div>
  );
}
