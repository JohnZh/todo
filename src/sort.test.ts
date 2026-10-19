import { describe, expect, it } from "vitest";
import { sortTodos } from "./sort.js";
import { createTodo, toggle } from "./todo.js";

const todos = [
  createTodo(3, "banana"),
  toggle(createTodo(1, "Cherry")),
  createTodo(4, "apple"),
  toggle(createTodo(2, "Apple")),
];

describe("sortTodos", () => {
  it("sorts by id ascending", () => {
    expect(sortTodos(todos, "id").map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });

  it("sorts by title case-insensitively, breaking ties by id", () => {
    expect(sortTodos(todos, "title").map((t) => t.id)).toEqual([2, 4, 3, 1]);
  });

  it("ignores accents when comparing titles, breaking ties by id", () => {
    const accented = [createTodo(2, "cafe"), createTodo(1, "Café"), createTodo(3, "bar")];
    expect(sortTodos(accented, "title").map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("sorts undone before done, breaking ties by id", () => {
    expect(sortTodos(todos, "done").map((t) => t.id)).toEqual([3, 4, 1, 2]);
  });

  it("returns an empty list for an empty list", () => {
    expect(sortTodos([], "id")).toEqual([]);
    expect(sortTodos([], "title")).toEqual([]);
    expect(sortTodos([], "done")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [...todos];
    const result = sortTodos(input, "id");
    result.pop();
    sortTodos(input, "title");
    sortTodos(input, "done");
    expect(input).toEqual(todos);
  });
});
