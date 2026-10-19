import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTodos, parse, saveTodos, serialize } from "./persist.js";
import { createTodo, toggle } from "./todo.js";

const todos = [createTodo(1, "buy milk"), toggle(createTodo(2, "walk dog"))];

describe("serialize", () => {
  it("pretty-prints a JSON array", () => {
    expect(serialize(todos)).toBe(JSON.stringify(todos, null, 2));
  });
});

describe("parse", () => {
  it("round-trips serialize", () => {
    expect(parse(serialize(todos))).toEqual(todos);
  });

  it("throws on malformed JSON", () => {
    expect(() => parse("[{")).toThrow(Error);
  });

  it("rejects a non-array", () => {
    expect(() => parse("{}")).toThrow("todos must be a JSON array");
  });

  it("rejects an element that is not an object", () => {
    expect(() => parse("[null]")).toThrow("todo[0] must be an object");
  });

  it.each([
    ["id", { title: "x", done: false }, "todo[1].id must be a number"],
    ["id", { id: "2", title: "x", done: false }, "todo[1].id must be a number"],
    ["title", { id: 2, done: false }, "todo[1].title must be a non-empty string"],
    ["title", { id: 2, title: 7, done: false }, "todo[1].title must be a non-empty string"],
    ["title", { id: 2, title: "", done: false }, "todo[1].title must be a non-empty string"],
    ["title", { id: 2, title: "   ", done: false }, "todo[1].title must be a non-empty string"],
    ["done", { id: 2, title: "x" }, "todo[1].done must be a boolean"],
    ["done", { id: 2, title: "x", done: "true" }, "todo[1].done must be a boolean"],
  ])("names the index and field when %s is wrong", (_field, bad, message) => {
    const json = JSON.stringify([{ id: 1, title: "ok", done: false }, bad]);
    expect(() => parse(json)).toThrow(message);
  });
});

describe("saveTodos / loadTodos", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "todo-persist-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips through a file", async () => {
    const path = join(dir, "todos.json");
    await saveTodos(path, todos);
    expect(await readFile(path, "utf8")).toBe(serialize(todos));
    expect(await loadTodos(path)).toEqual(todos);
  });

  it("overwrites an existing file and leaves no temp file behind", async () => {
    const path = join(dir, "todos.json");
    await saveTodos(path, todos);
    await saveTodos(path, [todos[0]!]);
    expect(await loadTodos(path)).toEqual([todos[0]]);
    expect(await readdir(dir)).toEqual(["todos.json"]);
  });

  it("loads a missing file as no todos", async () => {
    expect(await loadTodos(join(dir, "missing.json"))).toEqual([]);
  });

  it("propagates other read errors", async () => {
    await expect(loadTodos(dir)).rejects.toMatchObject({ code: "EISDIR" });
  });

  it("propagates validation errors from the file", async () => {
    const path = join(dir, "todos.json");
    await writeFile(path, '[{"id":1,"title":"x"}]');
    await expect(loadTodos(path)).rejects.toThrow("todo[0].done must be a boolean");
  });
});
