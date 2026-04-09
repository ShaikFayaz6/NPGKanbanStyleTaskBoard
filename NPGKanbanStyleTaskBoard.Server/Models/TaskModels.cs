namespace NPGKanbanStyleTaskBoard.Server.Models;

public sealed record TaskItem(
    Guid Id,
    string Title,
    string? Description,
    string Priority,
    DateOnly? DueDate,
    Guid? AssigneeId,
    string Status,
    DateTime CreatedAt
);

public sealed record CreateTaskRequest(
    string Title,
    string? Description,
    string? Priority,
    DateOnly? DueDate,
    Guid? AssigneeId
);

public sealed record UpdateTaskStatusRequest(string Status);

public sealed record TeamMember(
    Guid Id,
    string Name,
    string Color,
    DateTime CreatedAt
);

public sealed record CreateTeamMemberRequest(string Name, string? Color);
