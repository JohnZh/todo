import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTodos, parse, saveTodos, serialize, type SavedTodos } from "./persist.js";
import { createTodo, toggle } from "./todo.js";

const todos = [createTodo(1, "buy milk"), toggle(createTodo(2, "walk dog"))];
const saved: SavedTodos = { nextId: 5, todos };

describe("serialize", () => {
  it("pretty-prints an object with nextId and todos", () => {
    expect(serialize(saved)).toBe(JSON.stringify({ nextId: 5, todos }, null, 2));
  });
});

describe("parse", () => {
  it("round-trips serialize", () => {
    expect(parse(serialize(saved))).toEqual(saved);
  });

  it("keeps a nextId past every deleted todo", () => {
    expect(parse(JSON.stringify({ nextId: 4, todos: [] }))).toEqual({ nextId: 4, todos: [] });
  });

  it("throws on malformed JSON", () => {
    expect(() => parse("[{")).toThrow(Error);
  });

  it.each(["null", "7", '"todos"'])("rejects %s, which is neither an object nor an array", (json) => {
    expect(() => parse(json)).toThrow("todos file must be an object or a JSON array");
  });

  it.each([
    ["missing", {}],
    ["a string", { nextId: "4" }],
    ["zero", { nextId: 0 }],
    ["negative", { nextId: -1 }],
    ["a fraction", { nextId: 1.5 }],
  ])("rejects a nextId that is %s", (_case, fields) => {
    const json = JSON.stringify({ ...fields, todos: [] });
    expect(() => parse(json)).toThrow("nextId must be a positive integer");
  });

  it.each([
    ["equal to", 2],
    ["less than", 1],
  ])("rejects a nextId %s the highest saved id", (_case, nextId) => {
    const json = JSON.stringify({ nextId, todos });
    expect(() => parse(json)).toThrow(`nextId must be greater than every todo id, but ${nextId} <= 2`);
  });

  it("rejects todos that are not an array", () => {
    expect(() => parse('{"nextId":1}')).toThrow("todos must be a JSON array");
  });

  it("rejects an element that is not an object", () => {
    expect(() => parse('{"nextId":1,"todos":[null]}')).toThrow("todo[0] must be an object");
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
    const items = [{ id: 1, title: "ok", done: false }, bad];
    expect(() => parse(JSON.stringify({ nextId: 3, todos: items }))).toThrow(message);
    expect(() => parse(JSON.stringify(items))).toThrow(message);
  });

  describe("an old bare array", () => {
    it("takes nextId as the highest id + 1", () => {
      const json = JSON.stringify([todos[1], todos[0]]);
      expect(parse(json)).toEqual({ nextId: 3, todos: [todos[1], todos[0]] });
    });

    it("takes nextId as 1 when empty", () => {
      expect(parse("[]")).toEqual({ nextId: 1, todos: [] });
    });
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
    await saveTodos(path, saved);
    expect(await readFile(path, "utf8")).toBe(serialize(saved));
    expect(await loadTodos(path)).toEqual(saved);
  });

  it("overwrites an existing file and leaves no temp file behind", async () => {
    const path = join(dir, "todos.json");
    await saveTodos(path, saved);
    await saveTodos(path, { nextId: 5, todos: [todos[0]!] });
    expect(await loadTodos(path)).toEqual({ nextId: 5, todos: [todos[0]] });
    expect(await readdir(dir)).toEqual(["todos.json"]);
  });

  it("remembers nextId after every todo is deleted", async () => {
    const path = join(dir, "todos.json");
    await saveTodos(path, { nextId: 3, todos: [] });
    expect(await loadTodos(path)).toEqual({ nextId: 3, todos: [] });
  });

  it("loads an old bare-array file, and saving writes the new format", async () => {
    const path = join(dir, "todos.json");
    await writeFile(path, JSON.stringify(todos));
    const loaded = await loadTodos(path);
    expect(loaded).toEqual({ nextId: 3, todos });
    await saveTodos(path, loaded);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ nextId: 3, todos });
  });

  it("loads a missing file as no todos, starting ids at 1", async () => {
    expect(await loadTodos(join(dir, "missing.json"))).toEqual({ nextId: 1, todos: [] });
  });

  it("propagates other read errors", async () => {
    await expect(loadTodos(dir)).rejects.toMatchObject({ code: "EISDIR" });
  });

  it("propagates validation errors from the file", async () => {
    const path = join(dir, "todos.json");
    await writeFile(path, '{"nextId":2,"todos":[{"id":1,"title":"x"}]}');
    await expect(loadTodos(path)).rejects.toThrow("todo[0].done must be a boolean");
  });

  it("propagates a bad nextId from the file", async () => {
    const path = join(dir, "todos.json");
    await writeFile(path, '{"nextId":1,"todos":[{"id":1,"title":"x","done":false}]}');
    await expect(loadTodos(path)).rejects.toThrow("nextId must be greater than every todo id, but 1 <= 1");
  });
});
