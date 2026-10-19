import Foundation

/// Why the list could not be fetched.
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

    /// Every Todo in the order they were Added, with the Stats.
    public func list() async throws -> TodoList {
        let url = address.appending(path: "api/todos")
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

    /// Decodes a `GET /api/todos` response: `{ todos, stats }` on success, `{ error }` otherwise.
    public static func decodeList(status: Int, data: Data) throws -> TodoList {
        let decoder = JSONDecoder()
        if (200..<300).contains(status) {
            guard let list = try? decoder.decode(TodoList.self, from: data) else {
                throw TodoServerError.badResponse(status: status)
            }
            return list
        }
        guard let body = try? decoder.decode(ErrorBody.self, from: data) else {
            throw TodoServerError.badResponse(status: status)
        }
        throw TodoServerError.server(status: status, message: body.error)
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
    /// What the window says instead of the list.
    public var message: String {
        switch self {
        case .unreachable(let address):
            "Can't reach the todo server at \(address.absoluteString). Run “npm start” first."
        case .server(let status, let message):
            "The todo server answered \(status): \(message)"
        case .badResponse(let status):
            "The todo server answered \(status) with something that is not a todo list."
        }
    }
}
