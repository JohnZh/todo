import Foundation
import Testing
@testable import TodoClient

@Suite struct DecodeListTests {
    @Test func decodesTodosAndStats() throws {
        let json = """
            {"todos":[{"id":1,"title":"Buy milk","done":false},{"id":3,"title":"Walk the dog","done":true}],
             "stats":{"total":2,"active":1,"done":1}}
            """
        let list = try TodoServer.decodeList(status: 200, data: Data(json.utf8))
        #expect(
            list
                == TodoList(
                    todos: [Todo(id: 1, title: "Buy milk", done: false), Todo(id: 3, title: "Walk the dog", done: true)],
                    stats: Stats(total: 2, active: 1, done: 1)
                )
        )
    }

    @Test func decodesAnEmptyList() throws {
        let json = #"{"todos":[],"stats":{"total":0,"active":0,"done":0}}"#
        let list = try TodoServer.decodeList(status: 200, data: Data(json.utf8))
        #expect(list == TodoList(todos: [], stats: Stats(total: 0, active: 0, done: 0)))
    }

    @Test func throwsTheServersErrorMessage() {
        let json = #"{"error":"filter must be one of all, active, done"}"#
        #expect(throws: TodoServerError.server(status: 400, message: "filter must be one of all, active, done")) {
            try TodoServer.decodeList(status: 400, data: Data(json.utf8))
        }
    }

    @Test func rejectsABodyThatIsNotATodoList() {
        #expect(throws: TodoServerError.badResponse(status: 200)) {
            try TodoServer.decodeList(status: 200, data: Data("<html></html>".utf8))
        }
        #expect(throws: TodoServerError.badResponse(status: 502)) {
            try TodoServer.decodeList(status: 502, data: Data("Bad Gateway".utf8))
        }
    }
}

@Suite struct AddressTests {
    @Test func defaultsToLocalhostPort3000() {
        #expect(TodoServer.address(from: [:]) == URL(string: "http://127.0.0.1:3000")!)
        #expect(TodoServer.address(from: ["TODO_SERVER_URL": "  "]) == URL(string: "http://127.0.0.1:3000")!)
    }

    @Test func readsTodoServerURL() {
        #expect(TodoServer.address(from: ["TODO_SERVER_URL": "http://localhost:4000"]) == URL(string: "http://localhost:4000")!)
    }

    @Test func unreachableMessageNamesTheAddressAndNpmStart() {
        let message = TodoServerError.unreachable(URL(string: "http://127.0.0.1:3000")!).message
        #expect(message.contains("http://127.0.0.1:3000"))
        #expect(message.contains("npm start"))
    }
}

@Suite struct ListTests {
    @Test func reportsAnUnreachableServerByItsAddress() async throws {
        // Port 9 (discard) on loopback has nothing listening, so the connection is refused.
        let address = URL(string: "http://127.0.0.1:9")!
        await #expect(throws: TodoServerError.unreachable(address)) {
            try await TodoServer(address: address).list()
        }
    }
}

@Suite struct ChangeRequestTests {
    let address = URL(string: "http://127.0.0.1:3000")!

    /// The body as JSON values, so key order and formatting don't matter.
    func jsonBody(_ request: URLRequest) throws -> NSDictionary {
        let body = try #require(request.httpBody)
        return try #require(try JSONSerialization.jsonObject(with: body) as? NSDictionary)
    }

    @Test func addPostsTheTitle() throws {
        let request = TodoServer.addRequest(at: address, title: "Buy milk")
        #expect(request.httpMethod == "POST")
        #expect(request.url == URL(string: "http://127.0.0.1:3000/api/todos")!)
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(try jsonBody(request) == ["title": "Buy milk"])
    }

    @Test func renamePatchesTheTitleOfThatTodo() throws {
        let request = TodoServer.renameRequest(at: address, id: 7, title: "Walk the dog")
        #expect(request.httpMethod == "PATCH")
        #expect(request.url == URL(string: "http://127.0.0.1:3000/api/todos/7")!)
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(try jsonBody(request) == ["title": "Walk the dog"])
    }

    @Test func toggleOfAnActiveTodoPatchesItDone() throws {
        let request = TodoServer.toggleRequest(at: address, todo: Todo(id: 3, title: "Buy milk", done: false))
        #expect(request.httpMethod == "PATCH")
        #expect(request.url == URL(string: "http://127.0.0.1:3000/api/todos/3")!)
        #expect(try jsonBody(request) == ["done": true])
    }

    @Test func toggleOfADoneTodoPatchesItActive() throws {
        let request = TodoServer.toggleRequest(at: address, todo: Todo(id: 3, title: "Buy milk", done: true))
        #expect(request.httpMethod == "PATCH")
        #expect(request.url == URL(string: "http://127.0.0.1:3000/api/todos/3")!)
        #expect(try jsonBody(request) == ["done": false])
    }

    @Test func deleteSendsDeleteForThatTodoWithNoBody() {
        let request = TodoServer.deleteRequest(at: address, id: 12)
        #expect(request.httpMethod == "DELETE")
        #expect(request.url == URL(string: "http://127.0.0.1:3000/api/todos/12")!)
        #expect(request.httpBody == nil)
    }

    @Test func keepsAPathOnTheServerAddress() {
        let request = TodoServer.deleteRequest(at: URL(string: "http://example.test/todo")!, id: 1)
        #expect(request.url == URL(string: "http://example.test/todo/api/todos/1")!)
    }
}

@Suite struct CheckChangeTests {
    @Test func acceptsCreatedOkAndNoContent() throws {
        try TodoServer.checkChange(status: 201, data: Data(#"{"id":1,"title":"Buy milk","done":false}"#.utf8))
        try TodoServer.checkChange(status: 200, data: Data(#"{"id":1,"title":"Buy milk","done":true}"#.utf8))
        try TodoServer.checkChange(status: 204, data: Data())
    }

    @Test func throwsTheServersErrorForABlankTitle() {
        let json = #"{"error":"title must be a non-empty string"}"#
        #expect(throws: TodoServerError.server(status: 400, message: "title must be a non-empty string")) {
            try TodoServer.checkChange(status: 400, data: Data(json.utf8))
        }
    }

    @Test func throwsTheServersErrorForAnUnknownId() {
        let json = #"{"error":"no todo with id 42"}"#
        #expect(throws: TodoServerError.server(status: 404, message: "no todo with id 42")) {
            try TodoServer.checkChange(status: 404, data: Data(json.utf8))
        }
    }

    @Test func theErrorMessageShowsWhatTheServerSaid() {
        let message = TodoServerError.server(status: 400, message: "title must be a non-empty string").message
        #expect(message.contains("title must be a non-empty string"))
    }

    @Test func rejectsAFailureWithoutAnErrorBody() {
        #expect(throws: TodoServerError.badResponse(status: 502)) {
            try TodoServer.checkChange(status: 502, data: Data("Bad Gateway".utf8))
        }
    }

    @Test func reportsAnUnreachableServerByItsAddress() async throws {
        let address = URL(string: "http://127.0.0.1:9")!
        await #expect(throws: TodoServerError.unreachable(address)) {
            try await TodoServer(address: address).add(title: "Buy milk")
        }
    }
}
