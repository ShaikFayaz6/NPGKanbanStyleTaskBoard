async function send(path, method, token, body) {
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
        return undefined;
    }
    return (await response.json());
}
function normalizeTask(task) {
    return { ...task, labelIds: task.labelIds ?? [] };
}
export function getTasks(token) {
    return send("/api/tasks", "GET", token).then((rows) => rows.map(normalizeTask));
}
export function createTask(token, payload) {
    return send("/api/tasks", "POST", token, payload).then(normalizeTask);
}
export function updateTaskStatus(token, taskId, status) {
    return send(`/api/tasks/${taskId}/status`, "PATCH", token, { status }).then(normalizeTask);
}
export function updateTaskDueDate(token, taskId, dueDate) {
    return send(`/api/tasks/${taskId}/due-date`, "PATCH", token, { dueDate }).then(normalizeTask);
}
export function updateTaskLabels(token, taskId, labelIds) {
    return send(`/api/tasks/${taskId}/labels`, "PATCH", token, { labelIds }).then(normalizeTask);
}
export function deleteTask(token, taskId) {
    return send(`/api/tasks/${taskId}`, "DELETE", token);
}
export function getTaskActivity(token, taskId) {
    return send(`/api/tasks/${taskId}/activity`, "GET", token);
}
export function getTaskComments(token, taskId) {
    return send(`/api/tasks/${taskId}/comments`, "GET", token);
}
export function createTaskComment(token, taskId, body) {
    return send(`/api/tasks/${taskId}/comments`, "POST", token, { body });
}
export function getTeamMembers(token) {
    return send("/api/team-members", "GET", token);
}
export function createTeamMember(token, payload) {
    return send("/api/team-members", "POST", token, payload);
}
export function getLabels(token) {
    return send("/api/labels", "GET", token);
}
export function createLabel(token, payload) {
    return send("/api/labels", "POST", token, payload);
}
