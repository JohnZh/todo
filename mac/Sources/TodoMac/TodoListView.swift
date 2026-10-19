import AppKit
import SwiftUI
import TodoClient

struct TodoListView: View {
    @Bindable var model: TodoListModel

    var body: some View {
        content
            .frame(minWidth: 360, minHeight: 300)
            .toolbar {
                ToolbarItem {
                    Picker("Filter", selection: $model.filter) {
                        ForEach(Filter.allCases, id: \.self) { filter in
                            Text(filter.label).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                ToolbarItem {
                    Picker("Sort", selection: $model.sort) {
                        ForEach(Sort.allCases, id: \.self) { sort in
                            Text(sort.label).tag(sort)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            .task { await model.refresh() }
            .onChange(of: model.filter) { Task { await model.refresh() } }
            .onChange(of: model.sort) { Task { await model.refresh() } }
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

private extension Filter {
    var label: String {
        switch self {
        case .all: "All"
        case .active: "Active"
        case .done: "Done"
        }
    }
}

private extension Sort {
    var label: String {
        switch self {
        case .added: "Added"
        case .title: "Title"
        case .activeFirst: "Active first"
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
