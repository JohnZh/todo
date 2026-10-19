import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { filterTodos, stats, type Filter } from "./filter.js";
import { PAGE_HTML } from "./page.js";
import { loadTodos, saveTodos } from "./persist.js";
import { sortTodos, type SortKey } from "./sort.js";
import { TodoStore } from "./store.js";
import type { Todo } from "./todo.js";

const FILTERS: readonly Filter[] = ["all", "active", "done"];
const SORT_KEYS: readonly SortKey[] = ["id", "title", "done"];

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createTodoServer(path: string): Promise<Server> {
  let store = TodoStore.from(await loadTodos(path));
  // Mutations run one at a time, so saves land in order and a failed save can be undone.
  let queue = Promise.resolve();

  function mutate<T>(change: () => T): Promise<T> {
    const run = queue.then(async () => {
      const before = store.list();
      const result = change();
      try {
        await saveTodos(path, store.list());
      } catch (error) {
        store = TodoStore.from(before);
        throw error;
      }
      return result;
    });
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    if (url.pathname === "/" && method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE_HTML);
      return;
    }

    if (url.pathname === "/api/todos") {
      if (method === "GET") {
        const filter = oneOf(url.searchParams.get("filter") ?? "all", FILTERS, "filter");
        const sort = oneOf(url.searchParams.get("sort") ?? "id", SORT_KEYS, "sort");
        const todos = store.list();
        sendJson(res, 200, { todos: sortTodos(filterTodos(todos, filter), sort), stats: stats(todos) });
        return;
      }
      if (method === "POST") {
        const body = await readJsonObject(req);
        const title = requireTitle(body.title);
        sendJson(res, 201, await mutate(() => store.add(title)));
        return;
      }
    }

    const match = /^\/api\/todos\/(\d+)$/.exec(url.pathname);
    if (match !== null && method === "DELETE") {
      const id = Number(match[1]);
      await mutate(() => {
        if (!store.remove(id)) {
          throw unknownId(id);
        }
      });
      res.writeHead(204);
      res.end();
      return;
    }
    if (match !== null && method === "PATCH") {
      const id = Number(match[1]);
      if (store.get(id) === undefined) {
        throw unknownId(id);
      }
      const body = await readJsonObject(req);
      const title = body.title === undefined ? undefined : requireTitle(body.title);
      const done = body.done;
      if (done !== undefined && typeof done !== "boolean") {
        throw new HttpError(400, "done must be a boolean");
      }
      const updated = await mutate((): Todo => {
        let todo = store.get(id);
        if (todo === undefined) {
          throw unknownId(id);
        }
        if (title !== undefined) {
          todo = store.rename(id, title);
        }
        if (done !== undefined && todo.done !== done) {
          todo = store.toggle(id);
        }
        return todo;
      });
      sendJson(res, 200, updated);
      return;
    }

    throw new HttpError(404, `no route for ${method} ${url.pathname}`);
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, status, { error: message });
    });
  });
}

function unknownId(id: number): HttpError {
  return new HttpError(404, `no todo with id ${id}`);
}

function oneOf<T extends string>(value: string, allowed: readonly T[], name: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new HttpError(400, `${name} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function requireTitle(title: unknown): string {
  if (typeof title !== "string" || title.trim() === "") {
    throw new HttpError(400, "title must be a non-empty string");
  }
  return title;
}

async function readJsonObject(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
