import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTodos, saveTodos } from "./persist.js";
import { createTodoServer } from "./server.js";
import type { Todo } from "./todo.js";

let dir: string;
let path: string;
let servers: Server[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "todo-server-"));
  path = join(dir, "todos.json");
  servers = [];
});

afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  await rm(dir, { recursive: true, force: true });
});

async function start(): Promise<string> {
  const server = await createTodoServer(path);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function seed(todos: Todo[]): Promise<void> {
  await saveTodos(path, todos);
}

// saveTodos renames a fresh temp file over the old one, so any save changes the inode.
async function fingerprint(): Promise<{ ino: number; content: string }> {
  return { ino: (await stat(path)).ino, content: await readFile(path, "utf8") };
}

const seeded: Todo[] = [
  { id: 1, title: "banana", done: false },
  { id: 2, title: "Apple", done: true },
  { id: 3, title: "cherry", done: false },
];

describe("GET /", () => {
  it("serves the page as HTML with the add input", async () => {
    const base = await start();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain('<input id="new-title"');
  });
});

describe("GET /api/todos", () => {
  it("starts empty when the file is missing", async () => {
    const base = await start();
    const res = await fetch(`${base}/api/todos`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await res.json()).toEqual({ todos: [], stats: { total: 0, active: 0, done: 0 } });
  });

  it("defaults to every todo sorted by id", async () => {
    await seed([seeded[2]!, seeded[0]!, seeded[1]!]);
    const base = await start();
    const res = await fetch(`${base}/api/todos`);
    expect(await res.json()).toEqual({ todos: seeded, stats: { total: 3, active: 2, done: 1 } });
  });

  it("filters then sorts, counting stats over every todo", async () => {
    await seed(seeded);
    const base = await start();
    const res = await fetch(`${base}/api/todos?filter=active&sort=title`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { todos: Todo[]; stats: unknown };
    expect(body.todos.map((t) => t.id)).toEqual([1, 3]);
    expect(body.stats).toEqual({ total: 3, active: 2, done: 1 });
  });

  it.each([
    ["all", "title", [2, 1, 3]],
    ["done", "id", [2]],
    ["all", "done", [1, 3, 2]],
  ])("filter=%s&sort=%s", async (filter, sort, ids) => {
    await seed(seeded);
    const base = await start();
    const res = await fetch(`${base}/api/todos?filter=${filter}&sort=${sort}`);
    const body = (await res.json()) as { todos: Todo[] };
    expect(body.todos.map((t) => t.id)).toEqual(ids);
  });

  it.each([
    ["filter=everything", "filter must be one of all, active, done"],
    ["filter=", "filter must be one of all, active, done"],
    ["sort=date", "sort must be one of id, title, done"],
  ])("rejects %s with 400", async (query, error) => {
    const base = await start();
    const res = await fetch(`${base}/api/todos?${query}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });
});

describe("POST /api/todos", () => {
  it("creates a trimmed, undone todo, responds 201 and saves", async () => {
    const base = await start();
    const res = await send(`${base}/api/todos`, "POST", { title: "  buy milk " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 1, title: "buy milk", done: false });
    await send(`${base}/api/todos`, "POST", { title: "walk dog" });
    expect(await loadTodos(path)).toEqual([
      { id: 1, title: "buy milk", done: false },
      { id: 2, title: "walk dog", done: false },
    ]);
  });

  it.each([
    ["malformed JSON", "{", "body must be valid JSON"],
    ["an empty body", "", "body must be valid JSON"],
    ["a non-object body", "[]", "body must be a JSON object"],
    ["a missing title", {}, "title must be a non-empty string"],
    ["an empty title", { title: "   " }, "title must be a non-empty string"],
    ["a non-string title", { title: 7 }, "title must be a non-empty string"],
  ])("rejects %s with 400 and saves nothing", async (_case, body, error) => {
    await seed(seeded);
    const before = await fingerprint();
    const base = await start();
    const res = await send(`${base}/api/todos`, "POST", body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await fingerprint()).toEqual(before);
    const next = (await send(`${base}/api/todos`, "POST", { title: "next" }).then((r) => r.json())) as Todo;
    expect(next.id).toBe(4);
  });

  it("does not create the file when it rejects the request", async () => {
    const base = await start();
    expect((await send(`${base}/api/todos`, "POST", {})).status).toBe(400);
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("PATCH /api/todos/:id", () => {
  it("renames a todo, responds 200 and saves", async () => {
    await seed(seeded);
    const base = await start();
    const res = await send(`${base}/api/todos/2`, "PATCH", { title: " apricot " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 2, title: "apricot", done: true });
    expect((await loadTodos(path))[1]).toEqual({ id: 2, title: "apricot", done: true });
  });

  it.each([true, false])("sets done to %s", async (done) => {
    await seed(seeded);
    const base = await start();
    for (const id of [1, 2]) {
      const res = await send(`${base}/api/todos/${id}`, "PATCH", { done });
      expect(res.status).toBe(200);
      expect(((await res.json()) as Todo).done).toBe(done);
    }
    expect((await loadTodos(path)).map((t) => t.done)).toEqual([done, done, false]);
  });

  it("renames and sets done together", async () => {
    await seed(seeded);
    const base = await start();
    const res = await send(`${base}/api/todos/3`, "PATCH", { title: "plum", done: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 3, title: "plum", done: true });
    expect((await loadTodos(path))[2]).toEqual({ id: 3, title: "plum", done: true });
  });

  it.each([
    ["malformed JSON", "{", "body must be valid JSON"],
    ["a non-object body", "null", "body must be a JSON object"],
    ["an empty title", { title: "" }, "title must be a non-empty string"],
    ["a non-string title", { title: false }, "title must be a non-empty string"],
    ["a non-boolean done", { done: "true" }, "done must be a boolean"],
    ["a valid title with a non-boolean done", { title: "plum", done: 1 }, "done must be a boolean"],
    ["a null done", { done: null }, "done must be a boolean"],
  ])("rejects %s with 400 and changes nothing", async (_case, body, error) => {
    await seed(seeded);
    const before = await fingerprint();
    const base = await start();
    const res = await send(`${base}/api/todos/1`, "PATCH", body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await fingerprint()).toEqual(before);
    expect(((await fetch(`${base}/api/todos`).then((r) => r.json())) as { todos: Todo[] }).todos).toEqual(seeded);
  });

  it("responds 404 for an unknown id and changes nothing", async () => {
    await seed(seeded);
    const before = await fingerprint();
    const base = await start();
    const res = await send(`${base}/api/todos/4`, "PATCH", { done: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no todo with id 4" });
    expect(await fingerprint()).toEqual(before);
  });
});

describe("DELETE /api/todos/:id", () => {
  it("removes the todo, responds 204 and saves", async () => {
    await seed(seeded);
    const base = await start();
    const res = await fetch(`${base}/api/todos/2`, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await loadTodos(path)).map((t) => t.id)).toEqual([1, 3]);
  });

  it("responds 404 for an unknown id and changes nothing", async () => {
    await seed(seeded);
    const before = await fingerprint();
    const base = await start();
    const res = await fetch(`${base}/api/todos/9`, { method: "DELETE" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no todo with id 9" });
    expect(await fingerprint()).toEqual(before);
  });

  it("does not reuse the id of a removed todo after a 404", async () => {
    const base = await start();
    await send(`${base}/api/todos`, "POST", { title: "a" });
    await send(`${base}/api/todos`, "POST", { title: "b" });
    await fetch(`${base}/api/todos/2`, { method: "DELETE" });
    expect((await fetch(`${base}/api/todos/2`, { method: "DELETE" })).status).toBe(404);
    expect(((await send(`${base}/api/todos`, "POST", { title: "c" }).then((r) => r.json())) as Todo).id).toBe(3);
  });
});

describe("unknown routes", () => {
  it.each([
    ["GET", "/nope"],
    ["GET", "/api/todos/1"],
    ["PUT", "/api/todos/1"],
    ["DELETE", "/api/todos"],
    ["PATCH", "/api/todos/abc"],
    ["POST", "/"],
  ])("%s %s responds 404 and changes nothing", async (method, route) => {
    await seed(seeded);
    const before = await fingerprint();
    const base = await start();
    const res = await fetch(`${base}${route}`, { method });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no route for ${method} ${route}` });
    expect(await fingerprint()).toEqual(before);
  });
});

describe("persistence across servers", () => {
  it("a new server on the same file sees the saved todos and continues ids from the max", async () => {
    const first = await start();
    for (const title of ["a", "b", "c"]) {
      await send(`${first}/api/todos`, "POST", { title });
    }
    await send(`${first}/api/todos/1`, "PATCH", { done: true });
    await fetch(`${first}/api/todos/2`, { method: "DELETE" });

    const second = await start();
    const body = (await fetch(`${second}/api/todos`).then((r) => r.json())) as { todos: Todo[] };
    expect(body.todos).toEqual([
      { id: 1, title: "a", done: true },
      { id: 3, title: "c", done: false },
    ]);
    const res = await send(`${second}/api/todos`, "POST", { title: "d" });
    expect(await res.json()).toEqual({ id: 4, title: "d", done: false });
  });

  it("responds 500 and keeps the old todos when saving fails", async () => {
    await seed(seeded);
    const base = await start();
    await rm(dir, { recursive: true, force: true });
    const res = await send(`${base}/api/todos`, "POST", { title: "lost" });
    expect(res.status).toBe(500);
    expect(await res.json()).toHaveProperty("error");
    const body = (await fetch(`${base}/api/todos`).then((r) => r.json())) as { todos: Todo[] };
    expect(body.todos).toEqual(seeded);
  });
});
