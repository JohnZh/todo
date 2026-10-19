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

    init(server: TodoServer) {
        self.server = server
    }

    /// Fetches every Todo again. Called when the window comes to the front; there is no polling.
    func refresh() async {
        do {
            state = .loaded(try await server.list())
        } catch let error as TodoServerError {
            state = .failed(error.message)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
