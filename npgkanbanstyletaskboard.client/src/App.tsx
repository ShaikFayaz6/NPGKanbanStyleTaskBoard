import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createTask, createTeamMember, getTasks, getTeamMembers, updateTaskStatus } from "./api";
import { supabase } from "./supabase";
import type { Task, TaskStatus, TeamMember } from "./types";

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

function TaskCard({ task, assignee }: { task: Task; assignee?: TeamMember }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const dueBadge = toDueBadge(task.dueDate);

  return (
    <article ref={setNodeRef} style={style} className="task-card" {...attributes} {...listeners}>
      <h4>{task.title}</h4>
      {task.description ? <p>{task.description}</p> : null}
      <div className="task-meta">
        <span className={`priority ${task.priority}`}>{task.priority}</span>
        {task.dueDate ? <span>Due {task.dueDate}</span> : null}
      </div>
      <div className="task-meta">
        {dueBadge ? <span className={`due-badge ${dueBadge.className}`}>{dueBadge.label}</span> : <span />}
        {assignee ? (
          <span className="assignee-pill">
            <i style={{ background: assignee.color }} />
            {assignee.name}
          </span>
        ) : (
          <span className="assignee-pill empty-assignee">Unassigned</span>
        )}
      </div>
    </article>
  );
}

export function App() {
  const [accessToken, setAccessToken] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberColor, setMemberColor] = useState("#6366f1");
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "normal" | "high">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    async function bootstrap() {
      try {
        const session = await supabase.auth.getSession();
        let token = session.data.session?.access_token;
        if (!token) {
          const signedIn = await supabase.auth.signInAnonymously();
          token = signedIn.data.session?.access_token;
        }
        if (!token) {
          throw new Error("Guest session could not be created.");
        }
        setAccessToken(token);
        const [loadedTasks, loadedMembers] = await Promise.all([getTasks(token), getTeamMembers(token)]);
        setTasks(loadedTasks);
        setTeamMembers(loadedMembers);
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchMatch = task.title.toLowerCase().includes(searchText.toLowerCase());
      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
      const assigneeMatch = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter);
      return searchMatch && priorityMatch && assigneeMatch;
    });
  }, [tasks, searchText, priorityFilter, assigneeFilter]);

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
        dueDate: dueDate || null
        ,
        assigneeId: assigneeId || null
      });
      setTasks((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("normal");
      setAssigneeId("");
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
      </section>

      {error ? <p className="error">{error}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void onDragEnd(e)}>
        <section className="board">
          {columns.map((column) => (
            <section key={column.id} id={column.id} className="column">
              <h3>{column.label}</h3>
              <SortableContext items={grouped[column.id].map((task) => task.id)} strategy={verticalListSortingStrategy}>
                <div className="dropzone">
                  {grouped[column.id].length === 0 ? <p className="empty">No tasks yet.</p> : null}
                  {grouped[column.id].map((task) => (
                    <TaskCard key={task.id} task={task} assignee={task.assigneeId ? assigneeById[task.assigneeId] : undefined} />
                  ))}
                </div>
              </SortableContext>
            </section>
          ))}
        </section>
      </DndContext>
    </main>
  );
}
