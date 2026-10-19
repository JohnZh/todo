import AppKit
import SwiftUI
import TodoClient

struct TodoListView: View {
    let model: TodoListModel

    var body: some View {
        content
            .frame(minWidth: 360, minHeight: 300)
            .task { await model.refresh() }
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                Task { await model.refresh() }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label("No todo server", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            }
        case .loaded(let list):
            VStack(spacing: 0) {
                if list.todos.isEmpty {
                    ContentUnavailableView("No todos", systemImage: "checklist")
                } else {
                    List(list.todos) { todo in
                        TodoRow(todo: todo)
                    }
                }
                Divider()
                Text("\(list.stats.total) total / \(list.stats.active) active / \(list.stats.done) done")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
            }
        }
    }
}

private struct TodoRow: View {
    let todo: Todo

    var body: some View {
        HStack {
            Image(systemName: todo.done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(todo.done ? Color.accentColor : Color.secondary)
                .accessibilityLabel(todo.done ? "Done" : "Active")
            Text(todo.title)
                .strikethrough(todo.done)
                .foregroundStyle(todo.done ? .secondary : .primary)
        }
    }
}
