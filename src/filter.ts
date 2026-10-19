import type { Todo } from "./todo.js";

export type Filter = "all" | "active" | "done";

export function filterTodos(todos: Todo[], filter: Filter): Todo[] {
  switch (filter) {
    case "all":
      return [...todos];
    case "active":
      return todos.filter((todo) => !todo.done);
    case "done":
      return todos.filter((todo) => todo.done);
  }
}

export function stats(todos: Todo[]): { total: number; active: number; done: number } {
  const done = todos.filter((todo) => todo.done).length;
  return { total: todos.length, active: todos.length - done, done };
}
