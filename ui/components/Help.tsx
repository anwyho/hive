import { h } from "../../vendor/preact.module.js";
import { usePager } from "../hooks/usePager.js";
import { LESSONS } from "../lessons.js";
import { Legend, LessonDiagram } from "./LessonDiagram.js";
import { Sheet } from "./Sheet.js";

export function Help({
  start = 0,
  onClose,
}: {
  start?: number;
  onClose(): void;
}) {
  const pager = usePager(LESSONS.length, start);
  const lesson = LESSONS[pager.page]!;

  return (
    <Sheet title="How to play" onClose={onClose} class="help">
      <div class="help-page" {...pager.swipe}>
        <header class="help-head">
          <h3>{lesson.title}</h3>
          {lesson.expansion ? <span class="help-tag">Expansion</span> : null}
        </header>
        {lesson.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <Legend lesson={lesson} />
        <div class="help-diagrams">
          {lesson.diagrams.map((d) => (
            <LessonDiagram key={d.moves + d.show} diagram={d} />
          ))}
        </div>
      </div>
      <nav class="help-pager" aria-label="Lessons">
        <button class="btn" disabled={pager.first} onClick={pager.prev}>
          Prev
        </button>
        <span class="help-step" aria-live="polite">
          {pager.page + 1} / {LESSONS.length}
        </span>
        <button
          class="btn btn-primary"
          disabled={pager.last}
          onClick={pager.next}
        >
          Next
        </button>
      </nav>
    </Sheet>
  );
}
