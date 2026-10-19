export const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Todos</title>
<style>
  :root { color-scheme: light dark; --muted: #6b7280; --line: #d1d5db; --accent: #2563eb; --danger: #b91c1c; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.4 system-ui, sans-serif; display: flex; justify-content: center; }
  main { width: 100%; max-width: 36rem; padding: 2rem 1rem; }
  h1 { margin: 0 0 1rem; font-size: 1.5rem; }
  form, .controls, li { display: flex; gap: 0.5rem; align-items: center; }
  input[type="text"], select { font: inherit; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 4px; background: transparent; color: inherit; }
  #new-title { flex: 1; }
  button { font: inherit; padding: 0.4rem 0.75rem; border: 1px solid var(--line); border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
  button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
  .controls { margin: 1rem 0 0.5rem; justify-content: space-between; flex-wrap: wrap; }
  .tabs { display: flex; gap: 0.25rem; }
  #error { color: var(--danger); min-height: 1.4em; margin: 0.5rem 0 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
  li .title { flex: 1; cursor: text; overflow-wrap: anywhere; }
  li.done .title { text-decoration: line-through; color: var(--muted); }
  li input[type="text"] { flex: 1; }
  li .delete { color: var(--danger); }
  #empty { color: var(--muted); padding: 0.5rem 0; }
  footer { margin-top: 1rem; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>Todos</h1>
  <form id="add-form">
    <input id="new-title" type="text" placeholder="What needs doing?" aria-label="New todo" autocomplete="off">
    <button type="submit">Add</button>
  </form>
  <p id="error" role="alert"></p>
  <div class="controls">
    <div class="tabs" role="group" aria-label="Filter">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="active" aria-pressed="false">Active</button>
      <button type="button" data-filter="done" aria-pressed="false">Done</button>
    </div>
    <label>Sort by
      <select id="sort">
        <option value="id">id</option>
        <option value="title">title</option>
        <option value="done">done</option>
      </select>
    </label>
  </div>
  <ul id="list"></ul>
  <p id="empty" hidden>No todos.</p>
  <footer id="stats"></footer>
</main>
<script>
  var state = { filter: "all", sort: "id" };
  var form = document.getElementById("add-form");
  var input = document.getElementById("new-title");
  var errorBox = document.getElementById("error");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var statsBox = document.getElementById("stats");
  var sortSelect = document.getElementById("sort");
  var tabs = document.querySelectorAll("[data-filter]");

  function showError(message) {
    errorBox.textContent = message;
  }

  async function api(method, path, body) {
    var options = { method: method };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    var res = await fetch(path, options);
    if (!res.ok) {
      var message = res.status + " " + res.statusText;
      try {
        message = (await res.json()).error || message;
      } catch (e) {}
      throw new Error(message);
    }
    return res.status === 204 ? null : res.json();
  }

  async function run(action) {
    try {
      await action();
      showError("");
    } catch (e) {
      showError(e.message);
    }
    await refresh();
  }

  async function refresh() {
    try {
      var query = "?filter=" + encodeURIComponent(state.filter) + "&sort=" + encodeURIComponent(state.sort);
      render(await api("GET", "/api/todos" + query));
    } catch (e) {
      showError(e.message);
    }
  }

  function render(data) {
    list.replaceChildren.apply(list, data.todos.map(renderTodo));
    empty.hidden = data.todos.length > 0;
    statsBox.textContent = data.stats.total + " total / " + data.stats.active + " active / " + data.stats.done + " done";
  }

  function renderTodo(todo) {
    var li = document.createElement("li");
    li.className = todo.done ? "done" : "";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "Done");
    checkbox.addEventListener("change", function () {
      run(function () { return api("PATCH", "/api/todos/" + todo.id, { done: checkbox.checked }); });
    });

    var title = document.createElement("span");
    title.className = "title";
    title.textContent = todo.title;
    title.title = "Double-click to edit";
    title.addEventListener("dblclick", function () { startEdit(todo, title); });

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = "Delete";
    remove.addEventListener("click", function () {
      run(function () { return api("DELETE", "/api/todos/" + todo.id); });
    });

    li.append(checkbox, title, remove);
    return li;
  }

  function startEdit(todo, title) {
    var editor = document.createElement("input");
    editor.type = "text";
    editor.value = todo.title;
    editor.setAttribute("aria-label", "Edit title");
    var finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      if (save) {
        run(function () { return api("PATCH", "/api/todos/" + todo.id, { title: editor.value }); });
      } else {
        editor.replaceWith(title);
      }
    }
    editor.addEventListener("keydown", function (event) {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    editor.addEventListener("blur", function () { finish(false); });
    title.replaceWith(editor);
    editor.focus();
    editor.select();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(async function () {
      await api("POST", "/api/todos", { title: input.value });
      input.value = "";
    });
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.filter = tab.dataset.filter;
      tabs.forEach(function (other) { other.setAttribute("aria-pressed", String(other === tab)); });
      refresh();
    });
  });

  sortSelect.addEventListener("change", function () {
    state.sort = sortSelect.value;
    refresh();
  });

  refresh();
</script>
</body>
</html>
`;
