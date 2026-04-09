using NPGKanbanStyleTaskBoard.Server.Models;

namespace NPGKanbanStyleTaskBoard.Server.Services;

public interface ISupabaseTasksGateway
{
    Task<IReadOnlyList<TaskItem>> GetTasksAsync(string accessToken, CancellationToken cancellationToken);
    Task<TaskItem> CreateTaskAsync(string accessToken, CreateTaskRequest request, CancellationToken cancellationToken);
    Task<TaskItem> UpdateTaskStatusAsync(string accessToken, Guid taskId, string status, CancellationToken cancellationToken);
    Task<IReadOnlyList<TeamMember>> GetTeamMembersAsync(string accessToken, CancellationToken cancellationToken);
    Task<TeamMember> CreateTeamMemberAsync(string accessToken, CreateTeamMemberRequest request, CancellationToken cancellationToken);
}
