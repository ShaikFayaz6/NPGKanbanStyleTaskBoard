import type {
  CreateTagRequest,
  CreateLabelRequest,
  CreateTaskRequest,
  CreateTeamMemberRequest,
  Label,
  Tag,
  Task,
  TaskActivity,
  TaskComment,
  TaskStatus,
  TeamMember
} from "./types";

async function send<T>(path: string, method: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeTask(task: Task): Task {
  return { ...task, labelIds: task.labelIds ?? [], tagIds: task.tagIds ?? [] };
}

export function getTasks(token: string): Promise<Task[]> {
  return send<Task[]>("/api/tasks", "GET", token).then((rows) => rows.map(normalizeTask));
}

export function createTask(token: string, payload: CreateTaskRequest): Promise<Task> {
  return send<Task>("/api/tasks", "POST", token, payload).then(normalizeTask);
}

export function updateTaskStatus(token: string, taskId: string, status: TaskStatus): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/status`, "PATCH", token, { status }).then(normalizeTask);
}

export function updateTaskDueDate(token: string, taskId: string, dueDate: string | null): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/due-date`, "PATCH", token, { dueDate }).then(normalizeTask);
}

export function updateTaskLabels(token: string, taskId: string, labelIds: string[]): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/labels`, "PATCH", token, { labelIds }).then(normalizeTask);
}

export function updateTaskTags(token: string, taskId: string, tagIds: string[]): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/tags`, "PATCH", token, { tagIds }).then(normalizeTask);
}

export function deleteTask(token: string, taskId: string): Promise<void> {
  return send<void>(`/api/tasks/${taskId}`, "DELETE", token);
}

export function getTaskActivity(token: string, taskId: string): Promise<TaskActivity[]> {
  return send<TaskActivity[]>(`/api/tasks/${taskId}/activity`, "GET", token);
}

export function getTaskComments(token: string, taskId: string): Promise<TaskComment[]> {
  return send<TaskComment[]>(`/api/tasks/${taskId}/comments`, "GET", token);
}

export function createTaskComment(token: string, taskId: string, body: string): Promise<TaskComment> {
  return send<TaskComment>(`/api/tasks/${taskId}/comments`, "POST", token, { body });
}

export function getTeamMembers(token: string): Promise<TeamMember[]> {
  return send<TeamMember[]>("/api/team-members", "GET", token);
}

export function createTeamMember(token: string, payload: CreateTeamMemberRequest): Promise<TeamMember> {
  return send<TeamMember>("/api/team-members", "POST", token, payload);
}

export function getLabels(token: string): Promise<Label[]> {
  return send<Label[]>("/api/labels", "GET", token);
}

export function createLabel(token: string, payload: CreateLabelRequest): Promise<Label> {
  return send<Label>("/api/labels", "POST", token, payload);
}

export function getTags(token: string): Promise<Tag[]> {
  return send<Tag[]>("/api/tags", "GET", token);
}

export function createTag(token: string, payload: CreateTagRequest): Promise<Tag> {
  return send<Tag>("/api/tags", "POST", token, payload);
}
