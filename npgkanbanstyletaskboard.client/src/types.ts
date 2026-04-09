export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high";
  dueDate: string | null;
  assigneeId: string | null;
  status: TaskStatus;
  createdAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  priority?: "low" | "normal" | "high";
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CreateTeamMemberRequest {
  name: string;
  color?: string | null;
}
