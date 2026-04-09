using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using NPGKanbanStyleTaskBoard.Server.Models;

namespace NPGKanbanStyleTaskBoard.Server.Services;

public sealed class SupabaseTasksGateway(HttpClient httpClient, IOptions<SupabaseOptions> options) : ISupabaseTasksGateway
{
    private readonly SupabaseOptions _options = options.Value;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<TaskItem>> GetTasksAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(HttpMethod.Get, "/rest/v1/tasks?select=id,title,description,priority,due_date,assignee_id,status,created_at&order=created_at.desc", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        return rows.Select(MapFromRow).ToArray();
    }

    public async Task<TaskItem> CreateTaskAsync(string accessToken, CreateTaskRequest request, CancellationToken cancellationToken)
    {
        var payload = new
        {
            title = request.Title.Trim(),
            description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            priority = string.IsNullOrWhiteSpace(request.Priority) ? "normal" : request.Priority!.ToLowerInvariant(),
            due_date = request.DueDate?.ToString("yyyy-MM-dd"),
            assignee_id = request.AssigneeId,
            status = "todo"
        };

        using var httpRequest = BuildRequest(HttpMethod.Post, "/rest/v1/tasks?select=id,title,description,priority,due_date,assignee_id,status,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(payload);

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        return MapFromRow(rows.Single());
    }

    public async Task<TaskItem> UpdateTaskStatusAsync(string accessToken, Guid taskId, string status, CancellationToken cancellationToken)
    {
        using var httpRequest = BuildRequest(HttpMethod.Patch, $"/rest/v1/tasks?id=eq.{taskId}&select=id,title,description,priority,due_date,assignee_id,status,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(new { status });

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        return MapFromRow(rows.Single());
    }

    public async Task<IReadOnlyList<TeamMember>> GetTeamMembersAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(HttpMethod.Get, "/rest/v1/team_members?select=id,name,color,created_at&order=created_at.asc", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TeamMemberRow>>(JsonOptions, cancellationToken) ?? [];
        return rows.Select(row => new TeamMember(row.Id, row.Name, row.Color, row.CreatedAt)).ToArray();
    }

    public async Task<TeamMember> CreateTeamMemberAsync(string accessToken, CreateTeamMemberRequest request, CancellationToken cancellationToken)
    {
        var payload = new
        {
            name = request.Name.Trim(),
            color = string.IsNullOrWhiteSpace(request.Color) ? "#6366f1" : request.Color
        };

        using var httpRequest = BuildRequest(HttpMethod.Post, "/rest/v1/team_members?select=id,name,color,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(payload);

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TeamMemberRow>>(JsonOptions, cancellationToken) ?? [];
        var row = rows.Single();
        return new TeamMember(row.Id, row.Name, row.Color, row.CreatedAt);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path, string accessToken)
    {
        var baseUrl = _options.Url.TrimEnd('/');
        var message = new HttpRequestMessage(method, $"{baseUrl}{path}");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        message.Headers.Add("apikey", _options.AnonKey);
        return message;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var details = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new InvalidOperationException($"Supabase request failed: {(int)response.StatusCode} {details}");
    }

    private static TaskItem MapFromRow(TaskRow row)
    {
        DateOnly? dueDate = null;
        if (!string.IsNullOrWhiteSpace(row.DueDate) && DateOnly.TryParse(row.DueDate, out var parsedDueDate))
        {
            dueDate = parsedDueDate;
        }

        return new TaskItem(
            row.Id,
            row.Title,
            row.Description,
            row.Priority,
            dueDate,
            row.AssigneeId,
            row.Status,
            row.CreatedAt
        );
    }

    private sealed record TaskRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("priority")] string Priority,
        [property: JsonPropertyName("due_date")] string? DueDate,
        [property: JsonPropertyName("assignee_id")] Guid? AssigneeId,
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );

    private sealed record TeamMemberRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("color")] string Color,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );
}
