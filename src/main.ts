import { createTodoServer } from "./server.js";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
const file = process.env.TODOS_FILE ?? "./todos.json";

const server = await createTodoServer(file);
server.listen(port, host, () => {
  console.log(`Todos on http://${host}:${port}/ (saving to ${file})`);
});
