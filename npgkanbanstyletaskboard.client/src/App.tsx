import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createLabel,
  createTask,
  createTaskComment,
  createTeamMember,
  deleteTask,
  getLabels,
  getTaskActivity,
  getTaskComments,
  getTasks,
  getTeamMembers,
  updateTaskDueDate,
  updateTaskLabels,
  updateTaskStatus
} from "./api";
import { supabase } from "./supabase";
import type { Label, Task, TaskActivity, TaskComment, TaskStatus, TeamMember } from "./types";

const columns: Array<{ id: TaskStatus; label: string }> = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" }
];

function toDueBadge(dueDate: string | null): { label: string; className: string } | null {
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { label: "Overdue", className: "due-overdue" };
  if (diffDays <= 2) return { label: "Due Soon", className: "due-soon" };
  return { label: "Scheduled", className: "due-ok" };
}

function stageLabel(status: TaskStatus): string {
  return columns.find((c) => c.id === status)?.label ?? status;
}

/** Due-date urgency (not Kanban stage). Hidden once the task is completed. */
function dueUrgencyBadge(task: Task): { label: string; className: string } | null {
  if (task.status === "done") {
    return { label: "Completed", className: "stage-completed" };
  }
  return toDueBadge(task.dueDate);
}

function statusKeyToLabel(key: string | null | undefined): string {
  if (!key) return "";
  const found = columns.find((c) => c.id === key);
  return found?.label ?? key;
}

function formatActivityRow(row: TaskActivity): string {
  if (row.type === "status_changed") {
    return `Moved from ${statusKeyToLabel(row.fromValue)} to ${statusKeyToLabel(row.toValue)}`;
  }
  if (row.type === "due_date_changed") {
    return `Due date changed: ${row.fromValue ?? "none"} → ${row.toValue ?? "none"}`;
  }
  return "Task deleted";
}

type TimelineEntry =
  | { kind: "created"; at: string; label: string }
  | { kind: "activity"; row: TaskActivity };

function buildTimeline(task: Task, rows: TaskActivity[]): TimelineEntry[] {
  const created: TimelineEntry = {
    kind: "created",
    at: task.createdAt,
    label: `Task created (started in ${stageLabel("todo")})`
  };
  const activitySorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return [created, ...activitySorted.map((row) => ({ kind: "activity" as const, row }))];
}

function TaskCard({
  task,
  taskLabels,
  assignee,
  menuOpen,
  onToggleMenu,
  onOpenHistory,
  onRequestDelete
}: {
  task: Task;
  taskLabels: Label[];
  assignee?: TeamMember;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenHistory: () => void;
  onRequestDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const urgency = dueUrgencyBadge(task);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [titleTruncated, setTitleTruncated] = useState(false);
  const [descTruncated, setDescTruncated] = useState(false);
  const [fullText, setFullText] = useState<{ label: string; text: string } | null>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
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

  return (
    <article ref={setNodeRef} style={style} className="task-card" {...attributes} {...listeners}>
      <div
        className="task-card-menu"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="kebab"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleMenu();
          }}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Task options"
          title="Options"
        >
          ⋯
        </button>
        {menuOpen ? (
          <div className="task-menu-dropdown" role="menu">
            <button type="button" className="menu-item" role="menuitem" onClick={() => onOpenHistory()}>
              History
            </button>
            <button type="button" className="menu-item danger-text" role="menuitem" onClick={() => onRequestDelete()}>
              Delete
            </button>
          </div>
        ) : null}
      </div>
      <h4
        ref={titleRef}
        className={`task-card-title ${titleTruncated ? "is-truncated" : ""}`}
        title={titleTruncated ? "Click to read full title" : undefined}
        onClick={(e) => {
          if (!titleTruncated) return;
          e.preventDefault();
          e.stopPropagation();
          setFullText({ label: "Task name", text: task.title });
        }}
      >
        {task.title}
      </h4>
      {task.description ? (
        <p
          ref={descRef}
          className={`task-card-desc ${descTruncated ? "is-truncated" : ""}`}
          title={descTruncated ? "Click to read full description" : undefined}
          onClick={(e) => {
            if (!descTruncated) return;
            e.preventDefault();
            e.stopPropagation();
            setFullText({ label: "Description", text: task.description ?? "" });
          }}
        >
          {task.description}
        </p>
      ) : null}
      {taskLabels.length > 0 ? (
        <div className="task-label-chips" aria-label="Labels">
          {taskLabels.map((lb) => (
            <span key={lb.id} className="label-chip" style={{ borderColor: lb.color, color: lb.color }}>
              {lb.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="task-stage">
        <span className="stage-chip">Stage: {stageLabel(task.status)}</span>
      </div>
      <div className="task-meta">
        <span className={`priority ${task.priority}`}>{task.priority}</span>
        {task.dueDate ? <span>Due {task.dueDate}</span> : null}
      </div>
      <div className="task-meta">
        {urgency ? <span className={`due-badge ${urgency.className}`}>{urgency.label}</span> : <span />}
        {assignee ? (
          <span className="assignee-pill">
            <i style={{ background: assignee.color }} />
            {assignee.name}
          </span>
        ) : (
          <span className="assignee-pill empty-assignee">Unassigned</span>
        )}
      </div>

      {fullText ? (
        <div
          className="text-expand-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={fullText.label}
          onClick={() => setFullText(null)}
        >
          <div className="text-expand-panel" onClick={(e) => e.stopPropagation()}>
            <div className="text-expand-header">
              <strong>{fullText.label}</strong>
              <button type="button" className="ghost" onClick={() => setFullText(null)}>
                Close
              </button>
            </div>
            <p className="text-expand-body">{fullText.text}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Column({
  id,
  label,
  tasks,
  assigneeById,
  labelById,
  openMenuTaskId,
  onToggleMenu,
  onOpenHistory,
  onRequestDelete
}: {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  assigneeById: Record<string, TeamMember>;
  labelById: Record<string, Label>;
  openMenuTaskId: string | null;
  onToggleMenu: (taskId: string) => void;
  onOpenHistory: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section className="column">
      <h3>{label}</h3>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`dropzone ${isOver ? "dropzone-over" : ""}`}>
          {tasks.length === 0 ? <p className="empty">No tasks yet.</p> : null}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              taskLabels={task.labelIds.map((lid) => labelById[lid]).filter((x): x is Label => !!x)}
              assignee={task.assigneeId ? assigneeById[task.assigneeId] : undefined}
              menuOpen={openMenuTaskId === task.id}
              onToggleMenu={() => onToggleMenu(task.id)}
              onOpenHistory={() => onOpenHistory(task)}
              onRequestDelete={() => onRequestDelete(task)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function toggleLabelId(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

export function App() {
  const [accessToken, setAccessToken] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [createTaskLabelIds, setCreateTaskLabelIds] = useState<string[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberColor, setMemberColor] = useState("#6366f1");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#6366f1");
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "normal" | "high">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 }
    })
  );
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<TaskActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState<string>("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [labelDraft, setLabelDraft] = useState<string[]>([]);
  const [labelsSaving, setLabelsSaving] = useState(false);
  const menuCloseRef = useRef<(() => void) | null>(null);
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
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize board.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  const assigneeById = useMemo(() => {
    return teamMembers.reduce<Record<string, TeamMember>>((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [teamMembers]);

  const labelById = useMemo(() => {
    return labels.reduce<Record<string, Label>>((acc, lb) => {
      acc[lb.id] = lb;
      return acc;
    }, {});
  }, [labels]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchMatch = task.title.toLowerCase().includes(searchText.toLowerCase());
      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
      const assigneeMatch = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter);
      const labelMatch =
        labelFilter === "all" || (task.labelIds ?? []).includes(labelFilter);
      return searchMatch && priorityMatch && assigneeMatch && labelMatch;
    });
  }, [tasks, searchText, priorityFilter, assigneeFilter, labelFilter]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<TaskStatus, Task[]>>(
      (acc, col) => {
        acc[col.id] = filteredTasks.filter((task) => task.status === col.id);
        return acc;
      },
      { todo: [], in_progress: [], in_review: [], done: [] }
    );
  }, [filteredTasks]);

  const boardStats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((task) => task.status === "done").length;
    const overdue = filteredTasks.filter((task) => toDueBadge(task.dueDate)?.className === "due-overdue").length;
    return { total, completed, overdue };
  }, [filteredTasks]);

  async function onCreateTask(event: React.FormEvent<HTMLFormElement>) {
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
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create task.");
    }
  }

  async function onCreateTeamMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberName.trim() || !accessToken) return;

    try {
      const created = await createTeamMember(accessToken, { name: memberName.trim(), color: memberColor });
      setTeamMembers((current) => [...current, created]);
      setMemberName("");
      setMemberColor("#6366f1");
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Failed to create team member.");
    }
  }

  async function onCreateLabel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!labelName.trim() || !accessToken) return;

    try {
      const created = await createLabel(accessToken, { name: labelName.trim(), color: labelColor });
      setLabels((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setLabelName("");
      setLabelColor("#6366f1");
    } catch (labelErr) {
      setError(labelErr instanceof Error ? labelErr.message : "Failed to create label.");
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";
    if (!overId) return;

    const activeTask = tasks.find((task) => task.id === activeId);
    if (!activeTask) return;

    const targetColumn = columns.find((col) => col.id === overId) ? (overId as TaskStatus) : tasks.find((t) => t.id === overId)?.status;
    if (!targetColumn || activeTask.status === targetColumn || !accessToken) return;

    setTasks((current) => current.map((task) => (task.id === activeTask.id ? { ...task, status: targetColumn } : task)));
    try {
      const updated = await updateTaskStatus(accessToken, activeTask.id, targetColumn);
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to move task.");
      setTasks((current) => current.map((task) => (task.id === activeTask.id ? activeTask : task)));
    }
  }

  function toggleTaskMenu(taskId: string) {
    setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
  }

  async function openHistoryModal(task: Task) {
    if (!accessToken) return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setHistoryLoading(false);
      setCommentsLoading(false);
    }
  }

  async function saveTaskLabels() {
    if (!accessToken || !historyTask) return;
    setLabelsSaving(true);
    try {
      const updated = await updateTaskLabels(accessToken, historyTask.id, labelDraft);
      setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
      setHistoryTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update labels.");
    } finally {
      setLabelsSaving(false);
    }
  }

  async function submitComment() {
    if (!accessToken || !historyTask || !newCommentBody.trim()) return;
    try {
      const created = await createTaskComment(accessToken, historyTask.id, newCommentBody.trim());
      setComments((current) => [...current, created]);
      setNewCommentBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment.");
    }
  }

  async function saveDueDate() {
    if (!accessToken || !historyTask) return;
    try {
      const updated = await updateTaskDueDate(accessToken, historyTask.id, dueDateDraft || null);
      setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
      setHistoryTask((t) => (t && t.id === updated.id ? updated : t));
      const rows = await getTaskActivity(accessToken, updated.id);
      setHistory(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update due date.");
    }
  }

  function requestDeleteFromMenu(task: Task) {
    setOpenMenuTaskId(null);
    const ok = window.confirm("Are you sure you want to delete this task?");
    if (!ok) return;
    void removeTask(task);
  }

  async function removeTask(task: Task) {
    if (!accessToken) return;
    const snapshot = tasks;
    setTasks((current) => current.filter((t) => t.id !== task.id));
    try {
      await deleteTask(accessToken, task.id);
      setHistoryTask((t) => (t?.id === task.id ? null : t));
    } catch (err) {
      setTasks(snapshot);
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }

  if (loading) {
    return <main className="centered">Loading your task board...</main>;
  }

  return (
    <main className="layout">
      <header className="hero">
        <h1>Next Play Games Kanban Board</h1>
        <p>Drag tasks across stages. Each guest user sees only their own tasks.</p>
      </header>

      <section className="composer">
        <form onSubmit={onCreateTask}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" maxLength={100} required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={500} />
          <div className="row">
            <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <button type="submit">Create Task</button>
          </div>
          {labels.length > 0 ? (
            <fieldset className="label-pick-fieldset">
              <legend>Labels (optional)</legend>
              <div className="label-pick-row">
                {labels.map((lb) => (
                  <label key={lb.id} className="label-pick-item">
                    <input
                      type="checkbox"
                      checked={createTaskLabelIds.includes(lb.id)}
                      onChange={() => setCreateTaskLabelIds((prev) => toggleLabelId(prev, lb.id))}
                    />
                    <span className="label-chip mini" style={{ borderColor: lb.color, color: lb.color }}>
                      {lb.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </form>
      </section>

      <section className="composer">
        <form onSubmit={onCreateTeamMember}>
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Add team member name" maxLength={60} required />
          <div className="row">
            <input type="color" value={memberColor} onChange={(e) => setMemberColor(e.target.value)} />
            <button type="submit">Add Member</button>
          </div>
        </form>
      </section>

      <section className="composer">
        <form onSubmit={onCreateLabel}>
          <input value={labelName} onChange={(e) => setLabelName(e.target.value)} placeholder="New label name" maxLength={40} required />
          <div className="row">
            <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} />
            <button type="submit">Add Label</button>
          </div>
        </form>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><strong>{boardStats.total}</strong><span>Total</span></article>
        <article className="stat-card"><strong>{boardStats.completed}</strong><span>Completed</span></article>
        <article className="stat-card"><strong>{boardStats.overdue}</strong><span>Overdue</span></article>
      </section>

      <section className="filters">
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by title" />
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "all" | "low" | "normal" | "high")}>
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}>
          <option value="all">All Labels</option>
          {labels.map((lb) => (
            <option key={lb.id} value={lb.id}>
              {lb.name}
            </option>
          ))}
        </select>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void onDragEnd(e)}>
        <section className="board">
          {columns.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              label={column.label}
              tasks={grouped[column.id]}
              assigneeById={assigneeById}
              labelById={labelById}
              openMenuTaskId={openMenuTaskId}
              onToggleMenu={toggleTaskMenu}
              onOpenHistory={openHistoryModal}
              onRequestDelete={requestDeleteFromMenu}
            />
          ))}
        </section>
      </DndContext>

      {historyTask ? (
        <div className="modal-backdrop" onClick={() => setHistoryTask(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{historyTask.title}</strong>
              <button className="ghost" type="button" onClick={() => setHistoryTask(null)}>
                Close
              </button>
            </div>

            <div className="modal-section">
              <label className="label">Update due date</label>
              <div className="row">
                <input type="date" value={dueDateDraft} onChange={(e) => setDueDateDraft(e.target.value)} />
                <button type="button" onClick={() => void saveDueDate()}>
                  Save
                </button>
              </div>
            </div>

            {labels.length > 0 ? (
              <div className="modal-section">
                <label className="label">Labels on this task</label>
                <div className="label-pick-row modal-label-pick">
                  {labels.map((lb) => (
                    <label key={lb.id} className="label-pick-item">
                      <input
                        type="checkbox"
                        checked={labelDraft.includes(lb.id)}
                        onChange={() => setLabelDraft((prev) => toggleLabelId(prev, lb.id))}
                      />
                      <span className="label-chip mini" style={{ borderColor: lb.color, color: lb.color }}>
                        {lb.name}
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="ghost" disabled={labelsSaving} onClick={() => void saveTaskLabels()}>
                  {labelsSaving ? "Saving…" : "Save labels"}
                </button>
              </div>
            ) : null}

            <div className="modal-section">
              <label className="label">Comments</label>
              {commentsLoading ? (
                <p className="empty">Loading comments…</p>
              ) : comments.length === 0 ? (
                <p className="empty">No comments yet.</p>
              ) : (
                <ul className="comments-list">
                  {comments.map((c) => (
                    <li key={c.id} className="comment-item">
                      <p className="comment-body">{c.body}</p>
                      <time className="comment-time">{new Date(c.createdAt).toLocaleString()}</time>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row comment-compose">
                <textarea
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  placeholder="Write a comment…"
                  maxLength={4000}
                  rows={3}
                />
                <button type="button" onClick={() => void submitComment()} disabled={!newCommentBody.trim()}>
                  Post
                </button>
              </div>
            </div>

            <div className="modal-section">
              <label className="label">Activity timeline</label>
              <p className="timeline-hint">Newest changes appear at the bottom after creation.</p>
              {historyLoading ? (
                <p className="empty">Loading…</p>
              ) : (
                <ul className="history">
                  {buildTimeline(historyTask, history).map((entry, idx) =>
                    entry.kind === "created" ? (
                      <li key={`created-${idx}`}>
                        <span>{entry.label}</span>
                        <time>{new Date(entry.at).toLocaleString()}</time>
                      </li>
                    ) : (
                      <li key={entry.row.id}>
                        <span>{formatActivityRow(entry.row)}</span>
                        <time>{new Date(entry.row.createdAt).toLocaleString()}</time>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
