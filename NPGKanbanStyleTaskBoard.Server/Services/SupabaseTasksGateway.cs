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
        if (rows.Count == 0)
        {
            return [];
        }

        var taskIds = rows.Select(r => r.Id).ToArray();
        var labelMap = await GetLabelIdsMapAsync(accessToken, taskIds, cancellationToken);
        return rows.Select(r => ToTaskItem(r, labelMap.TryGetValue(r.Id, out var ids) ? ids : [])).ToArray();
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
        var taskId = rows.Single().Id;
        var labelIds = request.LabelIds ?? [];
        await ReplaceTaskLabelsAsync(accessToken, taskId, labelIds, cancellationToken);
        return await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);
    }

    public async Task<TaskItem> UpdateTaskStatusAsync(string accessToken, Guid taskId, string status, CancellationToken cancellationToken)
    {
        var before = await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);

        using var httpRequest = BuildRequest(HttpMethod.Patch, $"/rest/v1/tasks?id=eq.{taskId}&select=id,title,description,priority,due_date,assignee_id,status,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(new { status });

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        var updatedRow = rows.Single();

        await CreateActivityAsync(accessToken, taskId, "status_changed", before.Status, updatedRow.Status, cancellationToken);
        return ToTaskItem(updatedRow, before.LabelIds);
    }

    public async Task<TaskItem> UpdateTaskDueDateAsync(string accessToken, Guid taskId, DateOnly? dueDate, CancellationToken cancellationToken)
    {
        var before = await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);
        var dueDateString = dueDate?.ToString("yyyy-MM-dd");

        using var httpRequest = BuildRequest(HttpMethod.Patch, $"/rest/v1/tasks?id=eq.{taskId}&select=id,title,description,priority,due_date,assignee_id,status,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(new { due_date = dueDateString });

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        var updatedRow = rows.Single();

        await CreateActivityAsync(accessToken, taskId, "due_date_changed", before.DueDate?.ToString("yyyy-MM-dd"), ParseDueDate(updatedRow.DueDate)?.ToString("yyyy-MM-dd"), cancellationToken);
        return ToTaskItem(updatedRow, before.LabelIds);
    }

    public async Task<TaskItem> UpdateTaskLabelsAsync(string accessToken, Guid taskId, IReadOnlyList<Guid> labelIds, CancellationToken cancellationToken)
    {
        _ = await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);
        await ReplaceTaskLabelsAsync(accessToken, taskId, labelIds, cancellationToken);
        return await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);
    }

    public async Task DeleteTaskAsync(string accessToken, Guid taskId, CancellationToken cancellationToken)
    {
        await CreateActivityAsync(accessToken, taskId, "task_deleted", null, null, cancellationToken);

        using var request = BuildRequest(HttpMethod.Delete, $"/rest/v1/tasks?id=eq.{taskId}", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<TaskActivity>> GetTaskActivityAsync(string accessToken, Guid taskId, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(
            HttpMethod.Get,
            $"/rest/v1/task_activity?task_id=eq.{taskId}&select=id,task_id,type,from_value,to_value,created_at&order=created_at.desc",
            accessToken
        );
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskActivityRow>>(JsonOptions, cancellationToken) ?? [];
        return rows.Select(r => new TaskActivity(r.Id, r.TaskId, r.Type, r.FromValue, r.ToValue, r.CreatedAt)).ToArray();
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

    public async Task<IReadOnlyList<LabelItem>> GetLabelsAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(HttpMethod.Get, "/rest/v1/labels?select=id,name,color,created_at&order=name.asc", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<LabelRow>>(JsonOptions, cancellationToken) ?? [];
        return rows.Select(r => new LabelItem(r.Id, r.Name, r.Color, r.CreatedAt)).ToArray();
    }

    public async Task<LabelItem> CreateLabelAsync(string accessToken, CreateLabelRequest request, CancellationToken cancellationToken)
    {
        var payload = new
        {
            name = request.Name.Trim(),
            color = string.IsNullOrWhiteSpace(request.Color) ? "#6366f1" : request.Color
        };

        using var httpRequest = BuildRequest(HttpMethod.Post, "/rest/v1/labels?select=id,name,color,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(payload);

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<LabelRow>>(JsonOptions, cancellationToken) ?? [];
        var row = rows.Single();
        return new LabelItem(row.Id, row.Name, row.Color, row.CreatedAt);
    }

    public async Task<IReadOnlyList<TaskComment>> GetTaskCommentsAsync(string accessToken, Guid taskId, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(
            HttpMethod.Get,
            $"/rest/v1/task_comments?task_id=eq.{taskId}&select=id,task_id,body,created_at&order=created_at.asc",
            accessToken
        );
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskCommentRow>>(JsonOptions, cancellationToken) ?? [];
        return rows.Select(r => new TaskComment(r.Id, r.TaskId, r.Body, r.CreatedAt)).ToArray();
    }

    public async Task<TaskComment> CreateTaskCommentAsync(string accessToken, Guid taskId, string body, CancellationToken cancellationToken)
    {
        _ = await GetTaskItemByIdAsync(accessToken, taskId, cancellationToken);

        var payload = new { task_id = taskId, body = body.Trim() };

        using var httpRequest = BuildRequest(HttpMethod.Post, "/rest/v1/task_comments?select=id,task_id,body,created_at", accessToken);
        httpRequest.Headers.Add("Prefer", "return=representation");
        httpRequest.Content = JsonContent.Create(payload);

        using var response = await httpClient.SendAsync(httpRequest, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskCommentRow>>(JsonOptions, cancellationToken) ?? [];
        var row = rows.Single();
        return new TaskComment(row.Id, row.TaskId, row.Body, row.CreatedAt);
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

    private async Task<Dictionary<Guid, List<Guid>>> GetLabelIdsMapAsync(string accessToken, IReadOnlyList<Guid> taskIds, CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, List<Guid>>();
        if (taskIds.Count == 0)
        {
            return result;
        }

        var inClause = string.Join(",", taskIds.Select(id => id.ToString()));
        using var request = BuildRequest(HttpMethod.Get, $"/rest/v1/task_labels?select=task_id,label_id&task_id=in.({inClause})", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskLabelRow>>(JsonOptions, cancellationToken) ?? [];
        foreach (var row in rows)
        {
            if (!result.TryGetValue(row.TaskId, out var list))
            {
                list = [];
                result[row.TaskId] = list;
            }

            list.Add(row.LabelId);
        }

        return result;
    }

    private async Task ReplaceTaskLabelsAsync(string accessToken, Guid taskId, IReadOnlyList<Guid> labelIds, CancellationToken cancellationToken)
    {
        using var deleteRequest = BuildRequest(HttpMethod.Delete, $"/rest/v1/task_labels?task_id=eq.{taskId}", accessToken);
        using var deleteResponse = await httpClient.SendAsync(deleteRequest, cancellationToken);
        await EnsureSuccessAsync(deleteResponse, cancellationToken);

        if (labelIds.Count == 0)
        {
            return;
        }

        var payload = labelIds.Select(lid => new { task_id = taskId, label_id = lid }).ToArray();
        using var insertRequest = BuildRequest(HttpMethod.Post, "/rest/v1/task_labels?select=task_id", accessToken);
        insertRequest.Headers.Add("Prefer", "return=minimal");
        insertRequest.Content = JsonContent.Create(payload);

        using var insertResponse = await httpClient.SendAsync(insertRequest, cancellationToken);
        await EnsureSuccessAsync(insertResponse, cancellationToken);
    }

    private async Task<TaskItem> GetTaskItemByIdAsync(string accessToken, Guid taskId, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(
            HttpMethod.Get,
            $"/rest/v1/tasks?id=eq.{taskId}&select=id,title,description,priority,due_date,assignee_id,status,created_at",
            accessToken
        );
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var rows = await response.Content.ReadFromJsonAsync<List<TaskRow>>(JsonOptions, cancellationToken) ?? [];
        var row = rows.Single();
        var map = await GetLabelIdsMapAsync(accessToken, [taskId], cancellationToken);
        var labelIds = map.TryGetValue(taskId, out var ids) ? ids : [];
        return ToTaskItem(row, labelIds);
    }

    private static TaskItem ToTaskItem(TaskRow row, IReadOnlyList<Guid> labelIds)
    {
        var dueDate = ParseDueDate(row.DueDate);
        return new TaskItem(
            row.Id,
            row.Title,
            row.Description,
            row.Priority,
            dueDate,
            row.AssigneeId,
            row.Status,
            row.CreatedAt,
            labelIds
        );
    }

    private static DateOnly? ParseDueDate(string? dueDate)
    {
        if (string.IsNullOrWhiteSpace(dueDate) || !DateOnly.TryParse(dueDate, out var parsed))
        {
            return null;
        }

        return parsed;
    }

    private async Task CreateActivityAsync(string accessToken, Guid taskId, string type, string? fromValue, string? toValue, CancellationToken cancellationToken)
    {
        var payload = new { task_id = taskId, type, from_value = fromValue, to_value = toValue };

        using var request = BuildRequest(HttpMethod.Post, "/rest/v1/task_activity?select=id,task_id,type,from_value,to_value,created_at", accessToken);
        request.Headers.Add("Prefer", "return=minimal");
        request.Content = JsonContent.Create(payload);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
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

    private sealed record TaskLabelRow(
        [property: JsonPropertyName("task_id")] Guid TaskId,
        [property: JsonPropertyName("label_id")] Guid LabelId
    );

    private sealed record LabelRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("color")] string Color,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );

    private sealed record TaskCommentRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("task_id")] Guid TaskId,
        [property: JsonPropertyName("body")] string Body,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );

    private sealed record TaskActivityRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("task_id")] Guid TaskId,
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("from_value")] string? FromValue,
        [property: JsonPropertyName("to_value")] string? ToValue,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );

    private sealed record TeamMemberRow(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("color")] string Color,
        [property: JsonPropertyName("created_at")] DateTime CreatedAt
    );
}
