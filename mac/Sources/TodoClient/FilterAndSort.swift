/// Which Todos are shown. It only changes what is shown, never any Todo, and never the Stats.
public enum Filter: String, CaseIterable, Sendable {
    /// Every Todo.
    case all
    /// Only the Active Todos.
    case active
    /// Only the Done Todos.
    case done
}

/// The order Todos are shown in. Todos that tie stay in the order they were Added.
public enum Sort: String, CaseIterable, Sendable {
    /// The order they were Added.
    case added = "id"
    /// By Title alphabetically, ignoring case.
    case title
    /// Active before Done.
    case activeFirst = "done"
}
