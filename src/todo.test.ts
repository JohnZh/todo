import { describe, expect, it } from "vitest";
import { createTodo, toggle } from "./todo.js";

describe("createTodo", () => {
  it("trims the title and starts undone", () => {
    expect(createTodo(1, "  buy milk ")).toEqual({ id: 1, title: "buy milk", done: false });
  });

  it("rejects an empty title", () => {
    expect(() => createTodo(1, "   ")).toThrow("title must not be empty");
  });
});

describe("toggle", () => {
  it("flips done without mutating the original", () => {
    const todo = createTodo(1, "x");
    expect(toggle(todo).done).toBe(true);
    expect(todo.done).toBe(false);
  });
});
