import { createTodo, toggle, type Todo } from "./todo.js";

export class TodoStore {
  private readonly todos = new Map<number, Todo>();
  private nextId = 1;

  static from(todos: Todo[]): TodoStore {
    const store = new TodoStore();
    for (const todo of todos) {
      store.todos.set(todo.id, todo);
      store.nextId = Math.max(store.nextId, todo.id + 1);
    }
    return store;
  }

  add(title: string): Todo {
    const todo = createTodo(this.nextId, title);
    this.nextId++;
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
