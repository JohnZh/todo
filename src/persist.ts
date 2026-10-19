import { readFile, rename, rm, writeFile } from "node:fs/promises";
import type { Todo } from "./todo.js";

// nextId is saved so a deleted Todo's id is never given out again, even after a restart.
export interface SavedTodos {
  nextId: number;
  todos: Todo[];
}

export function serialize(saved: SavedTodos): string {
  return JSON.stringify({ nextId: saved.nextId, todos: saved.todos }, null, 2);
}

export function parse(json: string): SavedTodos {
  const data: unknown = JSON.parse(json);
  // The old format is a bare array; the best it can tell us is the highest id + 1.
  if (Array.isArray(data)) {
    const todos = parseTodos(data);
    return { nextId: highestId(todos) + 1, todos };
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("todos file must be an object or a JSON array");
  }
  const { nextId, todos } = data as Record<string, unknown>;
  if (typeof nextId !== "number" || !Number.isInteger(nextId) || nextId < 1) {
    throw new Error("nextId must be a positive integer");
  }
  if (!Array.isArray(todos)) {
    throw new Error("todos must be a JSON array");
  }
  const parsed = parseTodos(todos);
  const highest = highestId(parsed);
  if (nextId <= highest) {
    throw new Error(`nextId must be greater than every todo id, but ${nextId} <= ${highest}`);
  }
  return { nextId, todos: parsed };
}

function highestId(todos: Todo[]): number {
  return todos.reduce((highest, todo) => Math.max(highest, todo.id), 0);
}

function parseTodos(data: unknown[]): Todo[] {
  return data.map((item: unknown, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`todo[${index}] must be an object`);
    }
    const { id, title, done } = item as Record<string, unknown>;
    if (typeof id !== "number") {
      throw new Error(`todo[${index}].id must be a number`);
    }
    if (typeof title !== "string" || title.trim() === "") {
      throw new Error(`todo[${index}].title must be a non-empty string`);
    }
    if (typeof done !== "boolean") {
      throw new Error(`todo[${index}].done must be a boolean`);
    }
    return { id, title, done };
  });
}

let tempCounter = 0;

export async function saveTodos(path: string, saved: SavedTodos): Promise<void> {
  const temp = `${path}.${process.pid}.${tempCounter++}.tmp`;
  try {
    await writeFile(temp, serialize(saved));
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export async function loadTodos(path: string): Promise<SavedTodos> {
  let json: string;
  try {
    json = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { nextId: 1, todos: [] };
    }
    throw error;
  }
  return parse(json);
}
