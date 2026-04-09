using Microsoft.AspNetCore.Mvc;
using NPGKanbanStyleTaskBoard.Server.Models;
using NPGKanbanStyleTaskBoard.Server.Services;

namespace NPGKanbanStyleTaskBoard.Server.Controllers;

[ApiController]
[Route("api/tasks")]
public sealed class TasksController(ISupabaseTasksGateway gateway) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskItem>>> GetTasks(CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var tasks = await gateway.GetTasksAsync(accessToken, cancellationToken);
        return Ok(tasks);
    }

    [HttpPost]
    public async Task<ActionResult<TaskItem>> CreateTask([FromBody] CreateTaskRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Task title is required.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var created = await gateway.CreateTaskAsync(accessToken, request, cancellationToken);
        return Ok(created);
    }

    [HttpPatch("{taskId:guid}/status")]
    public async Task<ActionResult<TaskItem>> UpdateTaskStatus(Guid taskId, [FromBody] UpdateTaskStatusRequest request, CancellationToken cancellationToken)
    {
        var valid = request.Status is "todo" or "in_progress" or "in_review" or "done";
        if (!valid)
        {
            return BadRequest("Status must be one of todo, in_progress, in_review, done.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var updated = await gateway.UpdateTaskStatusAsync(accessToken, taskId, request.Status, cancellationToken);
        return Ok(updated);
    }

    private string ReadAccessToken()
    {
        var authHeader = HttpContext.Request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        return authHeader.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? authHeader[prefix.Length..].Trim()
            : string.Empty;
    }
}
