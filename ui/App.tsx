import { h } from "../vendor/preact.module.js";
import { useState } from "../vendor/hooks.module.js";
import type { GameOptions } from "../hive/index.js";
import { GameScreen } from "./components/GameScreen.js";
import { NewGame } from "./components/NewGame.js";
import { Sheet } from "./components/Sheet.js";
import { useGame } from "./hooks/useGame.js";
import { HOT_SEAT } from "./players.js";
import { importGame, type GameRecord } from "./record.js";

const DEFAULTS: GameOptions = {
  expansions: { mosquito: false, ladybug: false, pillbug: false },
  tournamentOpening: true,
};

export function App() {
  const game = useGame(HOT_SEAT);
  const [screen, setScreen] = useState<"setup" | "play">(
    game.record ? "play" : "setup",
  );
  const [importing, setImporting] = useState(false);
  /* Every started or imported game gets a fresh screen: view, selection and
     the game-over dialog all belong to one game. */
  const [games, setGames] = useState(0);
  const record = game.record;

  return (
    <div class="shell">
      {screen === "play" && record ? (
        <GameScreen
          key={games}
          game={{ ...game, record }}
          onNewGame={() => setScreen("setup")}
          onImport={() => setImporting(true)}
        />
      ) : (
        <NewGame
          initial={record?.options ?? DEFAULTS}
          canResume={!!record && !game.outcome}
          onStart={(options) => {
            game.start(options);
            setGames((n) => n + 1);
            setScreen("play");
          }}
          onResume={() => setScreen("play")}
          onImport={() => setImporting(true)}
        />
      )}
      {importing ? (
        <ImportSheet
          onClose={() => setImporting(false)}
          onLoad={(r) => {
            game.load(r);
            setGames((n) => n + 1);
            setImporting(false);
            setScreen("play");
          }}
        />
      ) : null}
    </div>
  );
}

function ImportSheet({
  onClose,
  onLoad,
}: {
  onClose(): void;
  onLoad(r: GameRecord): void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    try {
      onLoad(importGame(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Sheet title="Import a game record" onClose={onClose}>
      <p class="sheet-note">
        Paste a UHP game string, such as one copied from this app or Mzinga.
      </p>
      <textarea
        class="record-text"
        rows={5}
        aria-label="Game record"
        placeholder="Base+MLP;InProgress;White[3];wS1;bG1 -wS1;…"
        value={text}
        onInput={(e) => {
          setText((e.target as HTMLTextAreaElement).value);
          setError(null);
        }}
      />
      {error ? (
        <p class="sheet-error" role="alert">
          This record could not be read: {error}
        </p>
      ) : null}
      <div class="menu">
        <button class="btn btn-primary" disabled={!text.trim()} onClick={load}>
          Load game
        </button>
      </div>
    </Sheet>
  );
}
