// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "TodoMac",
    platforms: [.macOS(.v14)],
    targets: [
        // Talks to the todo server's HTTP API; every rule about Todos stays in the server.
        .target(name: "TodoClient"),
        .executableTarget(name: "TodoMac", dependencies: ["TodoClient"]),
        .testTarget(name: "TodoClientTests", dependencies: ["TodoClient"]),
    ]
)
