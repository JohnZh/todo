import AppKit
import SwiftUI
import TodoClient

@main
struct TodoMacApp: App {
    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate
    @State private var model = TodoListModel(
        server: TodoServer(address: TodoServer.address(from: ProcessInfo.processInfo.environment))
    )

    var body: some Scene {
        WindowGroup("Todos") {
            TodoListView(model: model)
        }
    }
}

/// `swift run` starts a bare executable, not an app bundle, so it has to ask for a Dock icon
/// and bring itself to the front.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
        // Activation is only a request the system may turn down, so also raise the window, once
        // SwiftUI has made it.
        DispatchQueue.main.async {
            NSApp.windows.first?.orderFrontRegardless()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
