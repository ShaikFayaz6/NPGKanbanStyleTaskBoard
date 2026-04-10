import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createLabel, createTask, createTaskComment, createTeamMember, deleteTask, getLabels, getTaskActivity, getTaskComments, getTasks, getTeamMembers, updateTaskDueDate, updateTaskLabels, updateTaskStatus } from "./api";
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
function statusKeyToLabel(key) {
    if (!key)
        return "";
    const found = columns.find((c) => c.id === key);
    return found?.label ?? key;
}
function formatActivityRow(row) {
    if (row.type === "status_changed") {
        return `Moved from ${statusKeyToLabel(row.fromValue)} to ${statusKeyToLabel(row.toValue)}`;
    }
    if (row.type === "due_date_changed") {
        return `Due date changed: ${row.fromValue ?? "none"} → ${row.toValue ?? "none"}`;
    }
    return "Task deleted";
}
function buildTimeline(task, rows) {
    const created = {
        kind: "created",
        at: task.createdAt,
        label: `Task created (started in ${stageLabel("todo")})`
    };
    const activitySorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return [created, ...activitySorted.map((row) => ({ kind: "activity", row }))];
}
function TaskCard({ task, taskLabels, labels, assignee, menuOpen, onToggleMenu, onOpenHistory, onRequestDelete, onQuickComment, onAttachLabel, onCreateLabelForTask }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const urgency = dueUrgencyBadge(task);
    const titleRef = useRef(null);
    const descRef = useRef(null);
    const [titleTruncated, setTitleTruncated] = useState(false);
    const [descTruncated, setDescTruncated] = useState(false);
    const [fullText, setFullText] = useState(null);
    const [menuView, setMenuView] = useState("main");
    const [commentDraft, setCommentDraft] = useState("");
    const [createNameDraft, setCreateNameDraft] = useState("");
    const [createColorDraft, setCreateColorDraft] = useState("#6366f1");
    const [menuBusy, setMenuBusy] = useState(false);
    const prevMenuOpen = useRef(false);
    useEffect(() => {
        if (menuOpen && !prevMenuOpen.current) {
            setMenuView("main");
            setCommentDraft("");
            setCreateNameDraft("");
            setCreateColorDraft("#6366f1");
        }
        prevMenuOpen.current = menuOpen;
    }, [menuOpen]);
    useLayoutEffect(() => {
        const el = titleRef.current;
        if (!el)
            return;
        setTitleTruncated(el.scrollWidth > el.clientWidth + 1);
    }, [task.title]);
    useLayoutEffect(() => {
        const el = descRef.current;
        if (!el) {
            setDescTruncated(false);
            return;
        }
        setDescTruncated(el.scrollHeight > el.clientHeight + 1);
    }, [task.description]);
    return (_jsxs("article", { ref: setNodeRef, style: style, className: "task-card", ...attributes, ...listeners, children: [_jsxs("div", { className: "task-card-menu", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "kebab", onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleMenu();
                        }, "aria-expanded": menuOpen, "aria-haspopup": "menu", "aria-label": "Task options", title: "Options", children: "\u22EF" }), menuOpen ? (_jsxs("div", { className: "task-menu-dropdown task-menu-dropdown-wide", role: "menu", onPointerDown: (e) => e.stopPropagation(), children: [menuView === "main" ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "menu-item", role: "menuitem", onClick: () => onOpenHistory(), children: "History" }), _jsx("button", { type: "button", className: "menu-item", role: "menuitem", onClick: () => setMenuView("comment"), children: "Add comment" }), _jsx("button", { type: "button", className: "menu-item", role: "menuitem", onClick: () => setMenuView("tags"), children: "Add tag" }), _jsx("button", { type: "button", className: "menu-item", role: "menuitem", onClick: () => setMenuView("labels"), children: "Add label" }), _jsx("button", { type: "button", className: "menu-item danger-text", role: "menuitem", onClick: () => onRequestDelete(), children: "Delete" })] })) : null, menuView === "comment" ? (_jsxs("div", { className: "task-menu-subpanel", children: [_jsx("button", { type: "button", className: "menu-back", onClick: () => setMenuView("main"), children: "\u2190 Back" }), _jsx("label", { className: "menu-field-label", children: "Comment" }), _jsx("textarea", { className: "task-menu-textarea", value: commentDraft, onChange: (e) => setCommentDraft(e.target.value), placeholder: "Write a comment\u2026", maxLength: 4000, rows: 4, disabled: menuBusy }), _jsx("button", { type: "button", className: "menu-primary-btn", disabled: menuBusy || !commentDraft.trim(), onClick: () => {
                                            void (async () => {
                                                setMenuBusy(true);
                                                try {
                                                    await onQuickComment(task.id, commentDraft);
                                                    setCommentDraft("");
                                                }
                                                finally {
                                                    setMenuBusy(false);
                                                }
                                            })();
                                        }, children: menuBusy ? "Saving…" : "Save comment" })] })) : null, menuView === "tags" ? (_jsxs("div", { className: "task-menu-subpanel task-menu-scroll", children: [_jsx("button", { type: "button", className: "menu-back", onClick: () => setMenuView("main"), children: "\u2190 Back" }), _jsx("p", { className: "menu-subtitle", children: "Choose a tag" }), labels.length === 0 ? _jsx("p", { className: "menu-empty-hint", children: "No tags yet." }) : null, labels.map((lb) => (_jsxs("button", { type: "button", className: "menu-item menu-pick-item", disabled: menuBusy || task.labelIds.includes(lb.id), onClick: () => {
                                            void (async () => {
                                                setMenuBusy(true);
                                                try {
                                                    await onAttachLabel(task.id, lb.id);
                                                }
                                                finally {
                                                    setMenuBusy(false);
                                                }
                                            })();
                                        }, children: [_jsx("span", { className: "label-chip mini", style: { borderColor: lb.color, color: lb.color }, children: lb.name }), task.labelIds.includes(lb.id) ? _jsx("span", { className: "menu-picked", children: " (on task)" }) : null] }, lb.id))), _jsx("button", { type: "button", className: "menu-item menu-create-end", onClick: () => setMenuView("tags-new"), children: "+ Create new tag" })] })) : null, menuView === "tags-new" ? (_jsxs("div", { className: "task-menu-subpanel", children: [_jsx("button", { type: "button", className: "menu-back", onClick: () => setMenuView("tags"), children: "\u2190 Back" }), _jsx("label", { className: "menu-field-label", children: "New tag name" }), _jsx("input", { type: "text", value: createNameDraft, onChange: (e) => setCreateNameDraft(e.target.value), placeholder: "Tag name", maxLength: 40, disabled: menuBusy }), _jsx("label", { className: "menu-field-label", children: "Color" }), _jsx("input", { type: "color", value: createColorDraft, onChange: (e) => setCreateColorDraft(e.target.value), disabled: menuBusy }), _jsx("button", { type: "button", className: "menu-primary-btn", disabled: menuBusy || !createNameDraft.trim(), onClick: () => {
                                            void (async () => {
                                                setMenuBusy(true);
                                                try {
                                                    await onCreateLabelForTask(task.id, createNameDraft, createColorDraft);
                                                    setCreateNameDraft("");
                                                    setCreateColorDraft("#6366f1");
                                                }
                                                finally {
                                                    setMenuBusy(false);
                                                }
                                            })();
                                        }, children: menuBusy ? "Saving…" : "Save tag" })] })) : null, menuView === "labels" ? (_jsxs("div", { className: "task-menu-subpanel task-menu-scroll", children: [_jsx("button", { type: "button", className: "menu-back", onClick: () => setMenuView("main"), children: "\u2190 Back" }), _jsx("p", { className: "menu-subtitle", children: "Choose a label" }), labels.length === 0 ? _jsx("p", { className: "menu-empty-hint", children: "No labels yet." }) : null, labels.map((lb) => (_jsxs("button", { type: "button", className: "menu-item menu-pick-item", disabled: menuBusy || task.labelIds.includes(lb.id), onClick: () => {
                                            void (async () => {
                                                setMenuBusy(true);
                                                try {
                                                    await onAttachLabel(task.id, lb.id);
                                                }
                                                finally {
                                                    setMenuBusy(false);
                                                }
                                            })();
                                        }, children: [_jsx("span", { className: "label-chip mini", style: { borderColor: lb.color, color: lb.color }, children: lb.name }), task.labelIds.includes(lb.id) ? _jsx("span", { className: "menu-picked", children: " (on task)" }) : null] }, `lb-${lb.id}`))), _jsx("button", { type: "button", className: "menu-item menu-create-end", onClick: () => setMenuView("labels-new"), children: "+ Create new label" })] })) : null, menuView === "labels-new" ? (_jsxs("div", { className: "task-menu-subpanel", children: [_jsx("button", { type: "button", className: "menu-back", onClick: () => setMenuView("labels"), children: "\u2190 Back" }), _jsx("label", { className: "menu-field-label", children: "New label name" }), _jsx("input", { type: "text", value: createNameDraft, onChange: (e) => setCreateNameDraft(e.target.value), placeholder: "Label name", maxLength: 40, disabled: menuBusy }), _jsx("label", { className: "menu-field-label", children: "Color" }), _jsx("input", { type: "color", value: createColorDraft, onChange: (e) => setCreateColorDraft(e.target.value), disabled: menuBusy }), _jsx("button", { type: "button", className: "menu-primary-btn", disabled: menuBusy || !createNameDraft.trim(), onClick: () => {
                                            void (async () => {
                                                setMenuBusy(true);
                                                try {
                                                    await onCreateLabelForTask(task.id, createNameDraft, createColorDraft);
                                                    setCreateNameDraft("");
                                                    setCreateColorDraft("#6366f1");
                                                }
                                                finally {
                                                    setMenuBusy(false);
                                                }
                                            })();
                                        }, children: menuBusy ? "Saving…" : "Save label" })] })) : null] })) : null] }), _jsx("h4", { ref: titleRef, className: `task-card-title ${titleTruncated ? "is-truncated" : ""}`, title: titleTruncated ? "Click to read full title" : undefined, onClick: (e) => {
                    if (!titleTruncated)
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    setFullText({ label: "Task name", text: task.title });
                }, children: task.title }), task.description ? (_jsx("p", { ref: descRef, className: `task-card-desc ${descTruncated ? "is-truncated" : ""}`, title: descTruncated ? "Click to read full description" : undefined, onClick: (e) => {
                    if (!descTruncated)
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    setFullText({ label: "Description", text: task.description ?? "" });
                }, children: task.description })) : null, taskLabels.length > 0 ? (_jsx("div", { className: "task-label-chips", "aria-label": "Labels", children: taskLabels.map((lb) => (_jsx("span", { className: "label-chip", style: { borderColor: lb.color, color: lb.color }, children: lb.name }, lb.id))) })) : null, _jsx("div", { className: "task-stage", children: _jsxs("span", { className: "stage-chip", children: ["Stage: ", stageLabel(task.status)] }) }), _jsxs("div", { className: "task-meta", children: [_jsx("span", { className: `priority ${task.priority}`, children: task.priority }), task.dueDate ? _jsxs("span", { children: ["Due ", task.dueDate] }) : null] }), _jsxs("div", { className: "task-meta", children: [urgency ? _jsx("span", { className: `due-badge ${urgency.className}`, children: urgency.label }) : _jsx("span", {}), assignee ? (_jsxs("span", { className: "assignee-pill", children: [_jsx("i", { style: { background: assignee.color } }), assignee.name] })) : (_jsx("span", { className: "assignee-pill empty-assignee", children: "Unassigned" }))] }), fullText ? (_jsx("div", { className: "text-expand-backdrop", role: "dialog", "aria-modal": "true", "aria-label": fullText.label, onClick: () => setFullText(null), children: _jsxs("div", { className: "text-expand-panel", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "text-expand-header", children: [_jsx("strong", { children: fullText.label }), _jsx("button", { type: "button", className: "ghost", onClick: () => setFullText(null), children: "Close" })] }), _jsx("p", { className: "text-expand-body", children: fullText.text })] }) })) : null] }));
}
function Column({ id, label, tasks, assigneeById, labelById, labels, openMenuTaskId, onToggleMenu, onOpenHistory, onRequestDelete, onQuickComment, onAttachLabel, onCreateLabelForTask }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (_jsxs("section", { className: "column", children: [_jsx("h3", { children: label }), _jsx(SortableContext, { items: tasks.map((task) => task.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { ref: setNodeRef, className: `dropzone ${isOver ? "dropzone-over" : ""}`, children: [tasks.length === 0 ? _jsx("p", { className: "empty", children: "No tasks yet." }) : null, tasks.map((task) => (_jsx(TaskCard, { task: task, taskLabels: task.labelIds.map((lid) => labelById[lid]).filter((x) => !!x), labels: labels, assignee: task.assigneeId ? assigneeById[task.assigneeId] : undefined, menuOpen: openMenuTaskId === task.id, onToggleMenu: () => onToggleMenu(task.id), onOpenHistory: () => onOpenHistory(task), onRequestDelete: () => onRequestDelete(task), onQuickComment: onQuickComment, onAttachLabel: onAttachLabel, onCreateLabelForTask: onCreateLabelForTask }, task.id)))] }) })] }));
}
function toggleLabelId(selected, id) {
    return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}
export function App() {
    const [accessToken, setAccessToken] = useState("");
    const [tasks, setTasks] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [labels, setLabels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("normal");
    const [dueDate, setDueDate] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [createTaskLabelIds, setCreateTaskLabelIds] = useState([]);
    const [memberName, setMemberName] = useState("");
    const [memberColor, setMemberColor] = useState("#6366f1");
    const [labelName, setLabelName] = useState("");
    const [labelColor, setLabelColor] = useState("#6366f1");
    const [searchText, setSearchText] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [assigneeFilter, setAssigneeFilter] = useState("all");
    const [labelFilter, setLabelFilter] = useState("all");
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 10 }
    }));
    const [openMenuTaskId, setOpenMenuTaskId] = useState(null);
    const [historyTask, setHistoryTask] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [dueDateDraft, setDueDateDraft] = useState("");
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [newCommentBody, setNewCommentBody] = useState("");
    const [labelDraft, setLabelDraft] = useState([]);
    const [labelsSaving, setLabelsSaving] = useState(false);
    const menuCloseRef = useRef(null);
    menuCloseRef.current = () => setOpenMenuTaskId(null);
    useEffect(() => {
        function onDocPointerDown() {
            menuCloseRef.current?.();
        }
        document.addEventListener("pointerdown", onDocPointerDown);
        return () => document.removeEventListener("pointerdown", onDocPointerDown);
    }, []);
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
                const [loadedTasks, loadedMembers, loadedLabels] = await Promise.all([
                    getTasks(token),
                    getTeamMembers(token),
                    getLabels(token)
                ]);
                setTasks(loadedTasks);
                setTeamMembers(loadedMembers);
                setLabels(loadedLabels);
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
    const labelById = useMemo(() => {
        return labels.reduce((acc, lb) => {
            acc[lb.id] = lb;
            return acc;
        }, {});
    }, [labels]);
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const searchMatch = task.title.toLowerCase().includes(searchText.toLowerCase());
            const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
            const assigneeMatch = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter);
            const labelMatch = labelFilter === "all" || (task.labelIds ?? []).includes(labelFilter);
            return searchMatch && priorityMatch && assigneeMatch && labelMatch;
        });
    }, [tasks, searchText, priorityFilter, assigneeFilter, labelFilter]);
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
                assigneeId: assigneeId || null,
                labelIds: createTaskLabelIds.length > 0 ? createTaskLabelIds : null
            });
            setTasks((current) => [created, ...current]);
            setTitle("");
            setDescription("");
            setDueDate("");
            setPriority("normal");
            setAssigneeId("");
            setCreateTaskLabelIds([]);
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
    async function onCreateLabel(event) {
        event.preventDefault();
        if (!labelName.trim() || !accessToken)
            return;
        try {
            const created = await createLabel(accessToken, { name: labelName.trim(), color: labelColor });
            setLabels((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
            setLabelName("");
            setLabelColor("#6366f1");
        }
        catch (labelErr) {
            setError(labelErr instanceof Error ? labelErr.message : "Failed to create label.");
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
    function toggleTaskMenu(taskId) {
        setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
    }
    async function openHistoryModal(task) {
        if (!accessToken)
            return;
        setOpenMenuTaskId(null);
        setHistoryTask(task);
        setDueDateDraft(task.dueDate ?? "");
        setLabelDraft([...(task.labelIds ?? [])]);
        setNewCommentBody("");
        setHistory([]);
        setComments([]);
        setHistoryLoading(true);
        setCommentsLoading(true);
        try {
            const [rows, commentRows] = await Promise.all([
                getTaskActivity(accessToken, task.id),
                getTaskComments(accessToken, task.id)
            ]);
            setHistory(rows);
            setComments(commentRows);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history.");
        }
        finally {
            setHistoryLoading(false);
            setCommentsLoading(false);
        }
    }
    async function saveTaskLabels() {
        if (!accessToken || !historyTask)
            return;
        setLabelsSaving(true);
        try {
            const updated = await updateTaskLabels(accessToken, historyTask.id, labelDraft);
            setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
            setHistoryTask(updated);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update labels.");
        }
        finally {
            setLabelsSaving(false);
        }
    }
    async function submitComment() {
        if (!accessToken || !historyTask || !newCommentBody.trim())
            return;
        try {
            const created = await createTaskComment(accessToken, historyTask.id, newCommentBody.trim());
            setComments((current) => [...current, created]);
            setNewCommentBody("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add comment.");
        }
    }
    async function postQuickCommentFromCard(taskId, body) {
        if (!accessToken || !body.trim())
            return;
        try {
            await createTaskComment(accessToken, taskId, body.trim());
            setOpenMenuTaskId(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save comment.");
        }
    }
    async function attachLabelToTaskFromCard(taskId, labelId) {
        if (!accessToken)
            return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.labelIds.includes(labelId))
            return;
        try {
            const updated = await updateTaskLabels(accessToken, taskId, [...task.labelIds, labelId]);
            setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
            setHistoryTask((t) => (t && t.id === taskId ? updated : t));
            setOpenMenuTaskId(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add tag/label.");
        }
    }
    async function createLabelForTaskFromCard(taskId, name, color) {
        if (!accessToken || !name.trim())
            return;
        try {
            const created = await createLabel(accessToken, { name: name.trim(), color });
            setLabels((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
            const task = tasks.find((t) => t.id === taskId);
            const nextIds = [...(task?.labelIds ?? []), created.id];
            const updated = await updateTaskLabels(accessToken, taskId, nextIds);
            setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
            setHistoryTask((t) => (t && t.id === taskId ? updated : t));
            setOpenMenuTaskId(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create tag/label.");
        }
    }
    async function saveDueDate() {
        if (!accessToken || !historyTask)
            return;
        try {
            const updated = await updateTaskDueDate(accessToken, historyTask.id, dueDateDraft || null);
            setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
            setHistoryTask((t) => (t && t.id === updated.id ? updated : t));
            const rows = await getTaskActivity(accessToken, updated.id);
            setHistory(rows);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update due date.");
        }
    }
    function requestDeleteFromMenu(task) {
        setOpenMenuTaskId(null);
        const ok = window.confirm("Are you sure you want to delete this task?");
        if (!ok)
            return;
        void removeTask(task);
    }
    async function removeTask(task) {
        if (!accessToken)
            return;
        const snapshot = tasks;
        setTasks((current) => current.filter((t) => t.id !== task.id));
        try {
            await deleteTask(accessToken, task.id);
            setHistoryTask((t) => (t?.id === task.id ? null : t));
        }
        catch (err) {
            setTasks(snapshot);
            setError(err instanceof Error ? err.message : "Failed to delete task.");
        }
    }
    if (loading) {
        return _jsx("main", { className: "centered", children: "Loading your task board..." });
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("header", { className: "hero", children: [_jsx("h1", { children: "Next Play Games Kanban Board" }), _jsx("p", { children: "Drag tasks across stages. Each guest user sees only their own tasks." })] }), _jsx("section", { className: "composer", children: _jsxs("form", { onSubmit: onCreateTask, children: [_jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Task title", maxLength: 100, required: true }), _jsx("textarea", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Description (optional)", maxLength: 500 }), _jsxs("div", { className: "row", children: [_jsxs("select", { value: priority, onChange: (e) => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] }), _jsxs("select", { value: assigneeId, onChange: (e) => setAssigneeId(e.target.value), children: [_jsx("option", { value: "", children: "Unassigned" }), teamMembers.map((member) => (_jsx("option", { value: member.id, children: member.name }, member.id)))] }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value) }), _jsx("button", { type: "submit", children: "Create Task" })] }), labels.length > 0 ? (_jsxs("fieldset", { className: "label-pick-fieldset", children: [_jsx("legend", { children: "Labels (optional)" }), _jsx("div", { className: "label-pick-row", children: labels.map((lb) => (_jsxs("label", { className: "label-pick-item", children: [_jsx("input", { type: "checkbox", checked: createTaskLabelIds.includes(lb.id), onChange: () => setCreateTaskLabelIds((prev) => toggleLabelId(prev, lb.id)) }), _jsx("span", { className: "label-chip mini", style: { borderColor: lb.color, color: lb.color }, children: lb.name })] }, lb.id))) })] })) : null] }) }), _jsx("section", { className: "composer", children: _jsxs("form", { onSubmit: onCreateTeamMember, children: [_jsx("input", { value: memberName, onChange: (e) => setMemberName(e.target.value), placeholder: "Add team member name", maxLength: 60, required: true }), _jsxs("div", { className: "row", children: [_jsx("input", { type: "color", value: memberColor, onChange: (e) => setMemberColor(e.target.value) }), _jsx("button", { type: "submit", children: "Add Member" })] })] }) }), _jsx("section", { className: "composer", children: _jsxs("form", { onSubmit: onCreateLabel, children: [_jsx("input", { value: labelName, onChange: (e) => setLabelName(e.target.value), placeholder: "New label name", maxLength: 40, required: true }), _jsxs("div", { className: "row", children: [_jsx("input", { type: "color", value: labelColor, onChange: (e) => setLabelColor(e.target.value) }), _jsx("button", { type: "submit", children: "Add Label" })] })] }) }), _jsxs("section", { className: "stats-grid", children: [_jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.total }), _jsx("span", { children: "Total" })] }), _jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.completed }), _jsx("span", { children: "Completed" })] }), _jsxs("article", { className: "stat-card", children: [_jsx("strong", { children: boardStats.overdue }), _jsx("span", { children: "Overdue" })] })] }), _jsxs("section", { className: "filters", children: [_jsx("input", { value: searchText, onChange: (e) => setSearchText(e.target.value), placeholder: "Search by title" }), _jsxs("select", { value: priorityFilter, onChange: (e) => setPriorityFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Priorities" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] }), _jsxs("select", { value: assigneeFilter, onChange: (e) => setAssigneeFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Assignees" }), _jsx("option", { value: "unassigned", children: "Unassigned" }), teamMembers.map((member) => (_jsx("option", { value: member.id, children: member.name }, member.id)))] }), _jsxs("select", { value: labelFilter, onChange: (e) => setLabelFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All Labels" }), labels.map((lb) => (_jsx("option", { value: lb.id, children: lb.name }, lb.id)))] })] }), error ? _jsx("p", { className: "error", children: error }) : null, _jsx(DndContext, { sensors: sensors, collisionDetection: closestCorners, onDragEnd: (e) => void onDragEnd(e), children: _jsx("section", { className: "board", children: columns.map((column) => (_jsx(Column, { id: column.id, label: column.label, tasks: grouped[column.id], assigneeById: assigneeById, labelById: labelById, labels: labels, openMenuTaskId: openMenuTaskId, onToggleMenu: toggleTaskMenu, onOpenHistory: openHistoryModal, onRequestDelete: requestDeleteFromMenu, onQuickComment: postQuickCommentFromCard, onAttachLabel: attachLabelToTaskFromCard, onCreateLabelForTask: createLabelForTaskFromCard }, column.id))) }) }), historyTask ? (_jsx("div", { className: "modal-backdrop", onClick: () => setHistoryTask(null), children: _jsxs("div", { className: "modal modal-wide", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("strong", { children: historyTask.title }), _jsx("button", { className: "ghost", type: "button", onClick: () => setHistoryTask(null), children: "Close" })] }), _jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "Update due date" }), _jsxs("div", { className: "row", children: [_jsx("input", { type: "date", value: dueDateDraft, onChange: (e) => setDueDateDraft(e.target.value) }), _jsx("button", { type: "button", onClick: () => void saveDueDate(), children: "Save" })] })] }), labels.length > 0 ? (_jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "Labels on this task" }), _jsx("div", { className: "label-pick-row modal-label-pick", children: labels.map((lb) => (_jsxs("label", { className: "label-pick-item", children: [_jsx("input", { type: "checkbox", checked: labelDraft.includes(lb.id), onChange: () => setLabelDraft((prev) => toggleLabelId(prev, lb.id)) }), _jsx("span", { className: "label-chip mini", style: { borderColor: lb.color, color: lb.color }, children: lb.name })] }, lb.id))) }), _jsx("button", { type: "button", className: "ghost", disabled: labelsSaving, onClick: () => void saveTaskLabels(), children: labelsSaving ? "Saving…" : "Save labels" })] })) : null, _jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "Comments" }), commentsLoading ? (_jsx("p", { className: "empty", children: "Loading comments\u2026" })) : comments.length === 0 ? (_jsx("p", { className: "empty", children: "No comments yet." })) : (_jsx("ul", { className: "comments-list", children: comments.map((c) => (_jsxs("li", { className: "comment-item", children: [_jsx("p", { className: "comment-body", children: c.body }), _jsx("time", { className: "comment-time", children: new Date(c.createdAt).toLocaleString() })] }, c.id))) })), _jsxs("div", { className: "row comment-compose", children: [_jsx("textarea", { value: newCommentBody, onChange: (e) => setNewCommentBody(e.target.value), placeholder: "Write a comment\u2026", maxLength: 4000, rows: 3 }), _jsx("button", { type: "button", onClick: () => void submitComment(), disabled: !newCommentBody.trim(), children: "Post" })] })] }), _jsxs("div", { className: "modal-section", children: [_jsx("label", { className: "label", children: "Activity timeline" }), _jsx("p", { className: "timeline-hint", children: "Newest changes appear at the bottom after creation." }), historyLoading ? (_jsx("p", { className: "empty", children: "Loading\u2026" })) : (_jsx("ul", { className: "history", children: buildTimeline(historyTask, history).map((entry, idx) => entry.kind === "created" ? (_jsxs("li", { children: [_jsx("span", { children: entry.label }), _jsx("time", { children: new Date(entry.at).toLocaleString() })] }, `created-${idx}`)) : (_jsxs("li", { children: [_jsx("span", { children: formatActivityRow(entry.row) }), _jsx("time", { children: new Date(entry.row.createdAt).toLocaleString() })] }, entry.row.id))) }))] })] }) })) : null] }));
}
