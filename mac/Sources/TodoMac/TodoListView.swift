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
                AddField(model: model)
                Divider()
                if list.todos.isEmpty {
                    ContentUnavailableView("No todos", systemImage: "checklist")
                } else {
                    List(list.todos) { todo in
                        TodoRow(todo: todo, model: model)
                    }
                }
                Divider()
                if let changeError = model.changeError {
                    Text(changeError)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding([.horizontal, .top], 8)
                }
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

/// The Title field and Add button; Return in the field also Adds.
private struct AddField: View {
    @Bindable var model: TodoListModel

    var body: some View {
        HStack {
            TextField("Title", text: $model.newTitle)
                .textFieldStyle(.roundedBorder)
                .onSubmit { Task { await model.add() } }
            Button("Add") { Task { await model.add() } }
        }
        .padding(8)
    }
}

/// One Todo. Its circle Toggles it, double-clicking its Title Renames it in place, and the trash
/// button Deletes it.
private struct TodoRow: View {
    let todo: Todo
    let model: TodoListModel
    /// The Title being typed while Renaming; `nil` when not Renaming.
    @State private var draft: String?
    @FocusState private var editing: Bool

    var body: some View {
        HStack {
            Button {
                Task { await model.toggle(todo) }
            } label: {
                Image(systemName: todo.done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(todo.done ? Color.accentColor : Color.secondary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(todo.done ? "Done" : "Active")
            .help(todo.done ? "Toggle to Active" : "Toggle to Done")
            if let draft {
                TextField("Title", text: Binding(get: { draft }, set: { self.draft = $0 }))
                    .textFieldStyle(.roundedBorder)
                    .focused($editing)
                    .onSubmit { Task { await rename(to: draft) } }
                    .onExitCommand { self.draft = nil }
                    .onAppear { editing = true }
            } else {
                Text(todo.title)
                    .strikethrough(todo.done)
                    .foregroundStyle(todo.done ? .secondary : .primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) { draft = todo.title }
            }
            Button {
                Task { await model.delete(todo) }
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Delete")
            .help("Delete")
        }
        .contextMenu {
            Button("Rename") { draft = todo.title }
            Button("Toggle") { Task { await model.toggle(todo) } }
            Button("Delete") { Task { await model.delete(todo) } }
        }
    }

    /// Saves the new Title. A Title the server rejects stays in the field so it can be fixed or
    /// cancelled with Escape.
    private func rename(to title: String) async {
        if await model.rename(todo, to: title) {
            draft = nil
        }
    }
}
