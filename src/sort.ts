import type { Todo } from "./todo.js";

export type SortKey = "id" | "title" | "done";

export function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  return [...todos].sort((a, b) => compareBy(a, b, key) || a.id - b.id);
}

function compareBy(a: Todo, b: Todo, key: SortKey): number {
  switch (key) {
    case "id":
      return 0;
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "done":
      return Number(a.done) - Number(b.done);
  }
}
