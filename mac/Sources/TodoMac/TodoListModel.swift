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
    /// The chosen Filter and Sort, kept for every fetch whatever caused it.
    var filter: Filter = .all
    var sort: Sort = .added

    init(server: TodoServer) {
        self.server = server
    }

    /// Fetches the list again in the chosen Filter and Sort. Called when the window comes to the
    /// front and when either choice changes; there is no polling.
    func refresh() async {
        let filter = filter
        let sort = sort
        let result: State
        do {
            result = .loaded(try await server.list(filter: filter, sort: sort))
        } catch let error as TodoServerError {
            result = .failed(error.message)
        } catch {
            result = .failed(error.localizedDescription)
        }
        // A fetch for a Filter or Sort that has since been changed again is out of date: the
        // fetch for the newer choice shows its own answer.
        guard filter == self.filter, sort == self.sort else { return }
        state = result
    }
}
