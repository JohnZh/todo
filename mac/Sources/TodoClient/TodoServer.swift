import Foundation

/// Why the list could not be fetched, or a change was not made.
public enum TodoServerError: Error, Equatable, Sendable {
    /// Nothing answered at the server address.
    case unreachable(URL)
    /// The server answered with an `{ error }` body.
    case server(status: Int, message: String)
    /// The server answered with something that is not the expected JSON.
    case badResponse(status: Int)
}

/// The todo server the app talks to. The app never reads or writes the todos file itself.
public struct TodoServer: Sendable {
    public static let defaultAddress = URL(string: "http://127.0.0.1:3000")!
    public static let addressVariable = "TODO_SERVER_URL"

    public let address: URL
    private let session: URLSession

    public init(address: URL, session: URLSession = .shared) {
        self.address = address
        self.session = session
    }

    /// The address from `TODO_SERVER_URL`, or the default when it is unset or blank.
    public static func address(from environment: [String: String]) -> URL {
        guard let value = environment[addressVariable]?.trimmingCharacters(in: .whitespaces),
              !value.isEmpty,
              let url = URL(string: value)
        else {
            return defaultAddress
        }
        return url
    }

    /// The Todos in the given Filter and Sort, with the Stats over every Todo.
    public func list(filter: Filter = .all, sort: Sort = .added) async throws -> TodoList {
        let url = listURL(filter: filter, sort: sort)
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch let error as URLError where Self.unreachableCodes.contains(error.code) {
            throw TodoServerError.unreachable(address)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        return try Self.decodeList(status: status, data: data)
    }

    /// The `GET /api/todos` address that asks for the given Filter and Sort.
    public func listURL(filter: Filter, sort: Sort) -> URL {
        address.appending(path: "api/todos").appending(queryItems: [
            URLQueryItem(name: "filter", value: filter.rawValue),
            URLQueryItem(name: "sort", value: sort.rawValue),
        ])
    }

    /// Decodes a `GET /api/todos` response: `{ todos, stats }` on success, `{ error }` otherwise.
    public static func decodeList(status: Int, data: Data) throws -> TodoList {
        let decoder = JSONDecoder()
        if (200..<300).contains(status) {
            guard let list = try? decoder.decode(TodoList.self, from: data) else {
                throw TodoServerError.badResponse(status: status)
            }
            return list
        }
        throw failure(status: status, data: data)
    }

    /// Adds a Todo with this Title. The server decides whether the Title is allowed.
    public func add(title: String) async throws {
        try await change(Self.addRequest(at: address, title: title))
    }

    /// Gives the Todo with this id a different Title.
    public func rename(id: Int, title: String) async throws {
        try await change(Self.renameRequest(at: address, id: id, title: title))
    }

    /// Flips this Todo between Active and Done.
    public func toggle(_ todo: Todo) async throws {
        try await change(Self.toggleRequest(at: address, todo: todo))
    }

    /// Takes the Todo with this id off the list for good.
    public func delete(id: Int) async throws {
        try await change(Self.deleteRequest(at: address, id: id))
    }

    /// `POST /api/todos` with `{ title }`.
    public static func addRequest(at address: URL, title: String) -> URLRequest {
        jsonRequest("POST", address.appending(path: "api/todos"), body: ["title": .string(title)])
    }

    /// `PATCH /api/todos/:id` with `{ title }`.
    public static func renameRequest(at address: URL, id: Int, title: String) -> URLRequest {
        jsonRequest("PATCH", todoURL(at: address, id: id), body: ["title": .string(title)])
    }

    /// `PATCH /api/todos/:id` with `{ done }` set to the opposite of what the Todo is now.
    public static func toggleRequest(at address: URL, todo: Todo) -> URLRequest {
        jsonRequest("PATCH", todoURL(at: address, id: todo.id), body: ["done": .bool(!todo.done)])
    }

    /// `DELETE /api/todos/:id`, with no body.
    public static func deleteRequest(at address: URL, id: Int) -> URLRequest {
        var request = URLRequest(url: todoURL(at: address, id: id))
        request.httpMethod = "DELETE"
        return request
    }

    /// Checks the response to a change: any 2xx is success, `{ error }` otherwise.
    public static func checkChange(status: Int, data: Data) throws {
        if (200..<300).contains(status) {
            return
        }
        throw failure(status: status, data: data)
    }

    /// The error for a non-2xx response: the server's `{ error }` message when it sent one.
    private static func failure(status: Int, data: Data) -> TodoServerError {
        guard let body = try? JSONDecoder().decode(ErrorBody.self, from: data) else {
            return .badResponse(status: status)
        }
        return .server(status: status, message: body.error)
    }

    private func change(_ request: URLRequest) async throws {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where Self.unreachableCodes.contains(error.code) {
            throw TodoServerError.unreachable(address)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        try Self.checkChange(status: status, data: data)
    }

    private static func todoURL(at address: URL, id: Int) -> URL {
        address.appending(path: "api/todos/\(id)")
    }

    /// A JSON body: only the fields a change sends.
    enum JSONValue: Encodable {
        case string(String)
        case bool(Bool)

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .string(let value): try container.encode(value)
            case .bool(let value): try container.encode(value)
            }
        }
    }

    private static func jsonRequest(_ method: String, _ url: URL, body: [String: JSONValue]) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try! JSONEncoder().encode(body)
        return request
    }

    private struct ErrorBody: Decodable {
        let error: String
    }

    private static let unreachableCodes: Set<URLError.Code> = [
        .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .notConnectedToInternet, .timedOut,
        .dnsLookupFailed,
    ]
}

extension TodoServerError {
    /// What the window says instead of the list, or beside it when a change was not made.
    public var message: String {
        switch self {
        case .unreachable(let address):
            "Can't reach the todo server at \(address.absoluteString). Run “npm start” first."
        case .server(let status, let message):
            "The todo server answered \(status): \(message)"
        case .badResponse(let status):
            "The todo server answered \(status) with something the app does not understand."
        }
    }
}
