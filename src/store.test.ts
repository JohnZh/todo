import { describe, expect, it } from "vitest";
import { TodoStore } from "./store.js";

describe("TodoStore.from", () => {
  it("holds the given todos in order", () => {
    const todos = [
      { id: 3, title: "c", done: true },
      { id: 1, title: "a", done: false },
    ];
    const store = TodoStore.from(todos);
    expect(store.list()).toEqual(todos);
    expect(store.get(3)).toEqual(todos[0]);
  });

  it("continues ids from the max id", () => {
    const store = TodoStore.from([
      { id: 5, title: "e", done: false },
      { id: 2, title: "b", done: false },
    ]);
    expect(store.add("f").id).toBe(6);
  });

  it("starts ids at 1 when empty", () => {
    expect(TodoStore.from([]).add("a").id).toBe(1);
  });

  it("continues ids from the given nextId when it is past the max id", () => {
    const store = TodoStore.from([{ id: 2, title: "b", done: false }], 5);
    expect(store.nextId).toBe(5);
    expect(store.add("e").id).toBe(5);
    expect(TodoStore.from([], 3).add("c").id).toBe(3);
  });

  it("ignores a nextId that is not past the max id", () => {
    expect(TodoStore.from([{ id: 4, title: "d", done: false }], 2).add("e").id).toBe(5);
  });

  it("does not change when the input array changes", () => {
    const todos = [{ id: 1, title: "a", done: false }];
    const store = TodoStore.from(todos);
    todos.push({ id: 2, title: "b", done: false });
    expect(store.list()).toHaveLength(1);
  });
});

describe("TodoStore.add", () => {
  it("builds a trimmed, undone todo with ids starting at 1", () => {
    const store = new TodoStore();
    expect(store.add("  buy milk ")).toEqual({ id: 1, title: "buy milk", done: false });
    expect(store.add("walk dog").id).toBe(2);
  });

  it("rejects an empty title without using up an id", () => {
    const store = new TodoStore();
    expect(() => store.add("   ")).toThrow("title must not be empty");
    expect(store.list()).toEqual([]);
    expect(store.add("x").id).toBe(1);
  });

  it("never reuses an id after a remove", () => {
    const store = new TodoStore();
    store.add("a");
    const b = store.add("b");
    store.remove(b.id);
    expect(store.nextId).toBe(3);
    expect(store.add("c").id).toBe(3);
  });
});

describe("TodoStore.list", () => {
  it("returns every todo in insertion order", () => {
    const store = new TodoStore();
    store.add("a");
    store.add("b");
    store.add("c");
    store.toggle(1);
    store.rename(2, "bee");
    expect(store.list().map((t) => t.title)).toEqual(["a", "bee", "c"]);
  });

  it("returns a copy, so mutating it does not change the store", () => {
    const store = new TodoStore();
    store.add("a");
    const list = store.list();
    list.push({ id: 99, title: "z", done: false });
    list.pop();
    list.pop();
    expect(store.list()).toHaveLength(1);
  });
});

describe("TodoStore.get", () => {
  it("finds a todo by id", () => {
    const store = new TodoStore();
    const todo = store.add("a");
    expect(store.get(todo.id)).toEqual(todo);
  });

  it("returns undefined for an unknown id", () => {
    expect(new TodoStore().get(1)).toBeUndefined();
  });
});

describe("TodoStore.remove", () => {
  it("removes the todo and returns true", () => {
    const store = new TodoStore();
    const todo = store.add("a");
    expect(store.remove(todo.id)).toBe(true);
    expect(store.get(todo.id)).toBeUndefined();
    expect(store.list()).toEqual([]);
  });

  it("returns false for an unknown id", () => {
    const store = new TodoStore();
    store.add("a");
    expect(store.remove(2)).toBe(false);
    expect(store.list()).toHaveLength(1);
  });
});

describe("TodoStore.toggle", () => {
  it("flips done and stores the result", () => {
    const store = new TodoStore();
    const todo = store.add("a");
    expect(store.toggle(todo.id).done).toBe(true);
    expect(store.get(todo.id)?.done).toBe(true);
    expect(store.toggle(todo.id).done).toBe(false);
  });

  it("throws on an unknown id", () => {
    expect(() => new TodoStore().toggle(1)).toThrow("no todo with id 1");
  });
});

describe("TodoStore.rename", () => {
  it("trims the new title and keeps id and done", () => {
    const store = new TodoStore();
    const todo = store.add("a");
    store.toggle(todo.id);
    expect(store.rename(todo.id, "  b ")).toEqual({ id: todo.id, title: "b", done: true });
    expect(store.get(todo.id)?.title).toBe("b");
  });

  it("rejects an empty title and leaves the todo unchanged", () => {
    const store = new TodoStore();
    const todo = store.add("a");
    expect(() => store.rename(todo.id, "   ")).toThrow("title must not be empty");
    expect(store.get(todo.id)?.title).toBe("a");
  });

  it("throws on an unknown id", () => {
    expect(() => new TodoStore().rename(1, "x")).toThrow("no todo with id 1");
  });
});
