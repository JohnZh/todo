import { describe, expect, it } from "vitest";
import { filterTodos, stats } from "./filter.js";
import { createTodo, toggle } from "./todo.js";

const todos = [
  createTodo(1, "a"),
  toggle(createTodo(2, "b")),
  createTodo(3, "c"),
  toggle(createTodo(4, "d")),
];

describe("filterTodos", () => {
  it("keeps every todo for all", () => {
    expect(filterTodos(todos, "all").map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });

  it("keeps undone todos in input order for active", () => {
    expect(filterTodos(todos, "active").map((t) => t.id)).toEqual([1, 3]);
  });

  it("keeps done todos in input order for done", () => {
    expect(filterTodos(todos, "done").map((t) => t.id)).toEqual([2, 4]);
  });

  it("returns an empty list for an empty list", () => {
    expect(filterTodos([], "all")).toEqual([]);
    expect(filterTodos([], "active")).toEqual([]);
    expect(filterTodos([], "done")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [...todos];
    const result = filterTodos(input, "all");
    result.pop();
    filterTodos(input, "active");
    filterTodos(input, "done");
    expect(input).toEqual(todos);
  });
});

describe("stats", () => {
  it("counts total, active and done", () => {
    expect(stats(todos)).toEqual({ total: 4, active: 2, done: 2 });
  });

  it("counts zero for an empty list", () => {
    expect(stats([])).toEqual({ total: 0, active: 0, done: 0 });
  });
});
