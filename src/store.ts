import { createTodo, toggle, type Todo } from "./todo.js";

export class TodoStore {
  private readonly todos = new Map<number, Todo>();
  private next = 1;

  // nextId lets a store pick up after Todos that were deleted before it was saved.
  static from(todos: Todo[], nextId = 1): TodoStore {
    const store = new TodoStore();
    store.next = nextId;
    for (const todo of todos) {
      store.todos.set(todo.id, todo);
      store.next = Math.max(store.next, todo.id + 1);
    }
    return store;
  }

  // The id the next Add will use; no Todo has ever had it.
  get nextId(): number {
    return this.next;
  }

  add(title: string): Todo {
    const todo = createTodo(this.next, title);
    this.next++;
    this.todos.set(todo.id, todo);
    return todo;
  }

  list(): Todo[] {
    return [...this.todos.values()];
  }

  get(id: number): Todo | undefined {
    return this.todos.get(id);
  }

  remove(id: number): boolean {
    return this.todos.delete(id);
  }

  toggle(id: number): Todo {
    const toggled = toggle(this.mustGet(id));
    this.todos.set(id, toggled);
    return toggled;
  }

  rename(id: number, title: string): Todo {
    const todo = this.mustGet(id);
    const renamed = { ...todo, title: createTodo(id, title).title };
    this.todos.set(id, renamed);
    return renamed;
  }

  private mustGet(id: number): Todo {
    const todo = this.todos.get(id);
    if (todo === undefined) {
      throw new Error(`no todo with id ${id}`);
    }
    return todo;
  }
}
