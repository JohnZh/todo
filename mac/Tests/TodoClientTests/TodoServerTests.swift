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
