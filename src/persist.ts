import { readFile, rename, rm, writeFile } from "node:fs/promises";
import type { Todo } from "./todo.js";

export function serialize(todos: Todo[]): string {
  return JSON.stringify(todos, null, 2);
}

export function parse(json: string): Todo[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    throw new Error("todos must be a JSON array");
  }
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

export async function saveTodos(path: string, todos: Todo[]): Promise<void> {
  const temp = `${path}.${process.pid}.${tempCounter++}.tmp`;
  try {
    await writeFile(temp, serialize(todos));
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export async function loadTodos(path: string): Promise<Todo[]> {
  let json: string;
  try {
    json = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return parse(json);
}
