import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createTask, createTeamMember, deleteTask, getTaskActivity, getTasks, getTeamMembers, updateTaskDueDate, updateTaskStatus } from "./api";
import { supabase } from "./supabase";
const columns = [
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "in_review", label: "In Review" },
    { id: "done", label: "Done" }
];
function toDueBadge(dueDate) {
    if (!dueDate)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0)
        return { label: "Overdue", className: "due-overdue" };
    if (diffDays <= 2)
        return { label: "Due Soon", className: "due-soon" };
    return { label: "Scheduled", className: "due-ok" };
}
function stageLabel(status) {
    return columns.find((c) => c.id === status)?.label ?? status;
}
/** Due-date urgency (not Kanban stage). Hidden once the task is completed. */
function dueUrgencyBadge(task) {
    if (task.status === "done") {
        return { label: "Completed", className: "stage-completed" };
    }
    return toDueBadge(task.dueDate);
}
function formatActivityRow(row) {
    if (row.type === "status_changed") {
        return `Moved: ${row.fromValue ?? ""} → ${row.toValue ?? ""}`;
    }
    if (row.type === "due_date_changed") {
        return `Due date: ${row.fromValue ?? "none"} → ${row.toValue ?? "none"}`;
    }
    return "Task deleted";
}
function TaskCard({ task, assignee, onEditDueDate, onDelete, onHistory }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const urgency = dueUrgencyBadge(task);
    return (_jsxs("article", { ref: setNodeRef, style: style, className: "task-card", ...attributes, ...listeners, children: [_jsx("button", { type: "button", className: "kebab", onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHistory(task);
                }, "aria-label": "Task options", title: "Options", children: "\u22EF" }), _jsx("h4", { children: task.title }), task.description ? _jsx("p", { children: task.description }) : null, _jsx("div", { className: "task-stage", children: _jsxs("span", { className: "stage-chip", children: ["Stage: ", stageLabel(task.status)] }) }), _jsxs("div", { className: "task-meta", children: [_jsx("span", { className: `priority ${task.priority}`, children: task.priority }), task.dueDate ? _jsxs("span", { children: ["Due ", task.dueDate] }) : null] }), _jsxs("div", { className: "task-meta", children: [urgency ? _jsx("span", { className: `due-badge ${urgency.className}`, children: urgency.label }) : _jsx("span", {}), assignee ? (_jsxs("span", { className: "assignee-pill", children: [_jsx("i", { style: { background: assignee.color } }), assignee.name] })) : (_jsx("span", { className: "assignee-pill empty-assignee", children: "Unassigned" }))] }), _jsxs("div", { className: "task-actions", children: [_jsx("button", { type: "button", className: "ghost", onClick: (e) => { e.preventDefault(); e.stopPropagation(); onEditDueDate(task); }, children: "Due date" }), _jsx("button", { type: "button", className: "ghost danger", onClick: (e) => { e.preventDefault(); e.stopPropagation(); onDelete(task); }, children: "Delete" })] })] }));
}
function Column({ id, label, tasks, assigneeById, onEditDueDate, onDelete, onHistory }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (_jsxs("section", { className: "column", children: [_jsx("h3", { children: label }), _jsx(SortableContext, { items: tasks.map((task) => task.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { ref: setNodeRef, className: `dropzone ${isOver ? "dropzone-over" : ""}`, children: [tasks.length === 0 ? _jsx("p", { className: "empty", children: "No tasks yet." }) : null, tasks.map((task) => (_jsx(TaskCard, { task: task, assignee: task.assigneeId ? assigneeById[task.assigneeId] : undefined, onEditDueDate: onEditDueDate, onDelete: onDelete, onHistory: onHistory }, task.id)))] }) })] }));
}
export function App() {
    const [accessToken, setAccessToken] = useState("");
    const [tasks, setTasks] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("normal");
    const [dueDate, setDueDate] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [memberName, setMemberName] = useState("");
    const [memberColor, setMemberColor] = useState("#6366f1");
    const [searchText, setSearchText] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [assigneeFilter, setAssigneeFilter] = useState("all");
    const sensors = useSensors(useSensor(PointerSensor));
    const [menuTask, setMenuTask] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [dueDateDraft, setDueDateDraft] = useState("");
    useEffect(() => {
        async function bootstrap() {
            try {
                const session = await supabase.auth.getSession();
                let token = session.data.session?.access_token;
                if (!token) {
                    const signedIn = await supabase.auth.signInAnonymously();
                    if (signedIn.error) {
                        throw new Error(`Supabase anonymous sign-in failed: ${signedIn.error.message}`);
                    }
                    token = signedIn.data.session?.access_token;
                }
                if (!token) {
                    throw new Error("Guest session could not be created (no access token returned).");
                }
                setAccessToken(token);
                const [loadedTasks, loadedMembers] = await Promise.all([getTasks(token), getTeamMembers(token)]);
                setTasks(loadedTasks);
                setTeamMembers(loadedMembers);
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Failed to initialize board.");
            }
            finally {
                setLoading(false);
            }
        }
        void bootstrap();
    }, []);
    const assigneeById = useMemo(() => {
        return teamMembers.reduce((acc, member) => {
            acc[member.id] = member;
            return acc;
        }, {});
    }, [teamMembers]);
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const searchMatch = task.title.toLowerCase().includes(searchText.toLowerCase());
            const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
            const assigneeMatch = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter);
            return searchMatch && priorityMatch && assigneeMatch;
        });
    }, [tasks, searchText, priorityFilter, assigneeFilter]);
    const grouped = useMemo(() => {
        return columns.reduce((acc, col) => {
            acc[col.id] = filteredTasks.filter((task) => task.status === col.id);
            return acc;
        }, { todo: [], in_progress: [], in_review: [], done: [] });
    }, [filteredTasks]);
    const boardStats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter((task) => task.status === "done").length;
        const overdue = filteredTasks.filter((task) => toDueBadge(task.dueDate)?.className === "due-overdue").length;
        return { total, completed, overdue };
    }, [filteredTasks]);
    async function onCreateTask(event) {
        event.preventDefault();
        if (!title.trim() || !accessToken) {
            return;
        }
        try {
            const created = await createTask(accessToken, {
                title: title.trim(),
                description: description.trim() || null,
                priority,
                dueDate: dueDate || null,
                assigneeId: assigneeId || null
            });
            setTasks((current) => [created, ...current]);
            setTitle("");
            setDescription("");
            setDueDate("");
            setPriority("normal");
            setAssigneeId("");
        }
        catch (createError) {
            setError(createError instanceof Error ? createError.message : "Failed to create task.");
        }
    }
    async function onCreateTeamMember(event) {
        event.preventDefault();
        if (!memberName.trim() || !accessToken)
            return;
        try {
            const created = await createTeamMember(accessToken, { name: memberName.trim(), color: memberColor });
            setTeamMembers((current) => [...current, created]);
            setMemberName("");
            setMemberColor("#6366f1");
        }
        catch (memberError) {
            setError(memberError instanceof Error ? memberError.message : "Failed to create team member.");
        }
    }
    async function onDragEnd(event) {
        const activeId = String(event.active.id);
        const overId = event.over?.id ? String(event.over.id) : "";
        if (!overId)
            return;
        const activeTask = tasks.find((task) => task.id === activeId);
        if (!activeTask)
            return;
        const targetColumn = columns.find((col) => col.id === overId) ? overId : tasks.find((t) => t.id === overId)?.status;
        if (!targetColumn || activeTask.status === targetColumn || !accessToken)
            return;
        setTasks((current) => current.map((task) => (task.id === activeTask.id ? { ...task, status: targetColumn } : task)));
        try {
            const updated = await updateTaskStatus(accessToken, activeTask.id, targetColumn);
            setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
        }
        catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Failed to move task.");
            setTasks((current) => current.map((task) => (task.id === activeTask.id ? activeTask : task)));
        }
    }
    async function openHistory(task) {
        if (!accessToken)
            return;
        setMenuTask(task);
        setMenuOpen(true);
        setHistory([]);
        setHistoryLoading(true);
        try {
            const rows = await getTaskActivity(accessToken, task.id);
            setHistory(rows);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history.");
        }
        finally {
            setHistoryLoading(false);
        }
    }
    function openDueDate(task) {
        setMenuTask(task);
        setDueDateDraft(task.dueDate ?? "");
        setMenuOpen(true);
    }
    async function saveDueDate() {
        if (!accessToken || !menuTask)
            return;
        try {
            const updated = await updateTaskDueDate(accessToken, menuTask.id, dueDateDraft || null);
            setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
            setMenuOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update due date.");
        }
    }
    async function removeTask(task) {
        if (!accessToken)
            return;
        const snapshot = tasks;
        setTasks((current) => current.filter((t) => t.id !== task.id));
        try {
            await deleteTask(accessToken, task.id);
            setMenuOpen(false);
        }
        catch (err) {
            setTasks(snapshot);
            setError(err instanceof Error ? err.message : "Failed to delete task.");
        }
    }
    if (loading) {
        return _jsx("main", { className: "centered", children: "Loading your task board..." });
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero", children: [_jsx("h1", { children: "Next Play Games Kanban Board" }), _jsx("p", { children: "Drag tasks across stages. Each guest user sees only their own tasks." })] }), _jsx("section", { className: "composer", children: _jsxs("form", { onSubmit: onCreateTask, children: [_jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Task title", maxLength: 100, required: true }), _jsx("textarea", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Description (optional)", maxLength: 500 }), _jsxs("div", { className: "row", children: [_jsxs("select", { value: priority, onChange: (e) => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] }), _jsxs("select", { value: assigneeId, onChange: (e) => setAssigneeId(e.target.value), children: [_jsx("option", { value: "", children: "Unassigned" }), teamMembers.map((member) => (_jsx("option", { value: member.id, children: member.name }, member.id)))] }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value) }), _jsx("button", { type: "submit", children: "Create Task" })] })] }) }), _jsx("section", { className: "composer", children: _jsxs("form", { onSubmit: onCreateTeamMember, children: [_jsx("input", { value: memberName, onChange: (e) => setMemberName(e.target.value), placeholder: "Add team member name", maxLength: 60, required: true }), _jsxs("div", { className: "row", children: [_jsx("input", { type: "color", value: memberColor, onChange: (e) => setMemberColor(e.target.value) }), _jsx("button", { type: "submit", children: "Add Member" })] })] }) }), _jsxs("section", { className: "stats-grid", children: [_jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.total }), _jsx("span", { children: "Total" })] }), _jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.completed }), _jsx("span", { children: "Completed" })] }), _jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.overdue }), _jsx("span", { children: "Overdue" })] })] }), _jsxs("section", { className: "filters", children: [_jsx("input", { value: searchText, onChange: (e) => setSearchText(e.target.value), placeholder: "Search by title" }), _jsxs("select", { value: priorityFilter, onChange: (e) => setPriorityFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Priorities" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] }), _jsxs("select", { value: assigneeFilter, onChange: (e) => setAssigneeFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Assignees" }), _jsx("option", { value: "unassigned", children: "Unassigned" }), teamMembers.map((member) => (_jsx("option", { value: member.id, children: member.name }, member.id)))] })] }), error ? _jsx("p", { className: "error", children: error }) : null, _jsx(DndContext, { sensors: sensors, collisionDetection: closestCorners, onDragEnd: (e) => void onDragEnd(e), children: _jsx("section", { className: "board", children: columns.map((column) => (_jsx(Column, { id: column.id, label: column.label, tasks: grouped[column.id], assigneeById: assigneeById, onEditDueDate: openDueDate, onDelete: removeTask, onHistory: openHistory }, column.id))) }) }), menuOpen && menuTask ? (_jsx("div", { className: "modal-backdrop", onClick: () => setMenuOpen(false), children: _jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("strong", { children: menuTask.title }), _jsx("button", { className: "ghost", type: "button", onClick: () => setMenuOpen(false), children: "Close" })] }), _jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "Update due date" }), _jsxs("div", { className: "row", children: [_jsx("input", { type: "date", value: dueDateDraft, onChange: (e) => setDueDateDraft(e.target.value) }), _jsx("button", { type: "button", onClick: () => void saveDueDate(), children: "Save" })] })] }), _jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "History" }), historyLoading ? (_jsx("p", { className: "empty", children: "Loading\u2026" })) : history.length === 0 ? (_jsx("p", { className: "empty", children: "No history yet." })) : (_jsx("ul", { className: "history", children: history.map((row) => (_jsxs("li", { children: [_jsx("span", { children: formatActivityRow(row) }), _jsx("time", { children: new Date(row.createdAt).toLocaleString() })] }, row.id))) }))] }), _jsx("div", { className: "modal-footer", children: _jsx("button", { type: "button", className: "danger", onClick: () => void removeTask(menuTask), children: "Delete task" }) })] }) })) : null] }));
}
