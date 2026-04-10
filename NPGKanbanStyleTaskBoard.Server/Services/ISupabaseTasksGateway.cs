using NPGKanbanStyleTaskBoard.Server.Models;

namespace NPGKanbanStyleTaskBoard.Server.Services;

public interface ISupabaseTasksGateway
{
    Task<IReadOnlyList<TaskItem>> GetTasksAsync(string accessToken, CancellationToken cancellationToken);
    Task<TaskItem> CreateTaskAsync(string accessToken, CreateTaskRequest request, CancellationToken cancellationToken);
    Task<TaskItem> UpdateTaskStatusAsync(string accessToken, Guid taskId, string status, CancellationToken cancellationToken);
    Task<TaskItem> UpdateTaskDueDateAsync(string accessToken, Guid taskId, DateOnly? dueDate, CancellationToken cancellationToken);
    Task<TaskItem> UpdateTaskLabelsAsync(string accessToken, Guid taskId, IReadOnlyList<Guid> labelIds, CancellationToken cancellationToken);
    Task DeleteTaskAsync(string accessToken, Guid taskId, CancellationToken cancellationToken);
    Task<IReadOnlyList<TaskActivity>> GetTaskActivityAsync(string accessToken, Guid taskId, CancellationToken cancellationToken);
    Task<IReadOnlyList<TeamMember>> GetTeamMembersAsync(string accessToken, CancellationToken cancellationToken);
    Task<TeamMember> CreateTeamMemberAsync(string accessToken, CreateTeamMemberRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<LabelItem>> GetLabelsAsync(string accessToken, CancellationToken cancellationToken);
    Task<LabelItem> CreateLabelAsync(string accessToken, CreateLabelRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<TaskComment>> GetTaskCommentsAsync(string accessToken, Guid taskId, CancellationToken cancellationToken);
    Task<TaskComment> CreateTaskCommentAsync(string accessToken, Guid taskId, string body, CancellationToken cancellationToken);
}
