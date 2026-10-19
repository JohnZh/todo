import Foundation
import Observation
import TodoClient

/// What the window shows: the list from the server, or why there is none.
@MainActor
@Observable
final class TodoListModel {
    enum State: Equatable {
        case loading
        case loaded(TodoList)
        case failed(String)
    }

    let server: TodoServer
    private(set) var state: State = .loading
    /// Why the last change was not made, shown beside the list until the next change succeeds.
    private(set) var changeError: String?
    /// The Title typed into the Add field.
    var newTitle = ""

    init(server: TodoServer) {
        self.server = server
    }

    /// Fetches every Todo again. Called when the window comes to the front and after each change;
    /// there is no polling.
    func refresh() async {
        do {
            state = .loaded(try await server.list())
        } catch let error as TodoServerError {
            state = .failed(error.message)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Adds a Todo with the typed Title, and clears the field once the server has it.
    func add() async {
        if await perform({ try await $0.add(title: self.newTitle) }) {
            newTitle = ""
        }
    }

    /// Returns whether the server made the change, so the row can stop editing.
    func rename(_ todo: Todo, to title: String) async -> Bool {
        await perform { try await $0.rename(id: todo.id, title: title) }
    }

    func toggle(_ todo: Todo) async {
        await perform { try await $0.toggle(todo) }
    }

    func delete(_ todo: Todo) async {
        await perform { try await $0.delete(id: todo.id) }
    }

    /// Sends one change, then fetches the list and Stats again. When the server rejects it, only
    /// its message is shown; when the server can't be reached, the window says so as it does on launch.
    @discardableResult
    private func perform(_ change: (TodoServer) async throws -> Void) async -> Bool {
        do {
            try await change(server)
        } catch TodoServerError.unreachable(let address) {
            changeError = nil
            state = .failed(TodoServerError.unreachable(address).message)
            return false
        } catch let error as TodoServerError {
            changeError = error.message
            return false
        } catch {
            changeError = error.localizedDescription
            return false
        }
        changeError = nil
        await refresh()
        return true
    }
}
