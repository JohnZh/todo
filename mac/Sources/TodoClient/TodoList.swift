import Foundation

/// One thing that needs doing, as the server sends it.
public struct Todo: Decodable, Equatable, Identifiable, Sendable {
    public let id: Int
    public let title: String
    /// `false` while the Todo is Active, `true` once it is Done.
    public let done: Bool

    public init(id: Int, title: String, done: Bool) {
        self.id = id
        self.title = title
        self.done = done
    }
}

/// How many Todos there are in total, Active and Done, whatever the Filter.
public struct Stats: Decodable, Equatable, Sendable {
    public let total: Int
    public let active: Int
    public let done: Int

    public init(total: Int, active: Int, done: Int) {
        self.total = total
        self.active = active
        self.done = done
    }
}

/// The body of `GET /api/todos`: the Todos in the requested Filter and Sort, and the Stats.
public struct TodoList: Decodable, Equatable, Sendable {
    public let todos: [Todo]
    public let stats: Stats

    public init(todos: [Todo], stats: Stats) {
        self.todos = todos
        self.stats = stats
    }
}
