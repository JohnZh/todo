export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export function createTodo(id: number, title: string): Todo {
  const trimmed = title.trim();
  if (trimmed === "") {
    throw new Error("title must not be empty");
  }
  return { id, title: trimmed, done: false };
}

export function toggle(todo: Todo): Todo {
  return { ...todo, done: !todo.done };
}
