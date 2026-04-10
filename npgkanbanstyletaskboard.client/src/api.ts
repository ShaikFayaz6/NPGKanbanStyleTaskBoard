import type { CreateTaskRequest, CreateTeamMemberRequest, Task, TaskActivity, TaskStatus, TeamMember } from "./types";

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

export function getTasks(token: string): Promise<Task[]> {
  return send<Task[]>("/api/tasks", "GET", token);
}

export function createTask(token: string, payload: CreateTaskRequest): Promise<Task> {
  return send<Task>("/api/tasks", "POST", token, payload);
}

export function updateTaskStatus(token: string, taskId: string, status: TaskStatus): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/status`, "PATCH", token, { status });
}

export function updateTaskDueDate(token: string, taskId: string, dueDate: string | null): Promise<Task> {
  return send<Task>(`/api/tasks/${taskId}/due-date`, "PATCH", token, { dueDate });
}

export function deleteTask(token: string, taskId: string): Promise<void> {
  return send<void>(`/api/tasks/${taskId}`, "DELETE", token);
}

export function getTaskActivity(token: string, taskId: string): Promise<TaskActivity[]> {
  return send<TaskActivity[]>(`/api/tasks/${taskId}/activity`, "GET", token);
}

export function getTeamMembers(token: string): Promise<TeamMember[]> {
  return send<TeamMember[]>("/api/team-members", "GET", token);
}

export function createTeamMember(token: string, payload: CreateTeamMemberRequest): Promise<TeamMember> {
  return send<TeamMember>("/api/team-members", "POST", token, payload);
}
