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

    [HttpPatch("{taskId:guid}/due-date")]
    public async Task<ActionResult<TaskItem>> UpdateTaskDueDate(Guid taskId, [FromBody] UpdateTaskDueDateRequest request, CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var updated = await gateway.UpdateTaskDueDateAsync(accessToken, taskId, request.DueDate, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{taskId:guid}")]
    public async Task<IActionResult> DeleteTask(Guid taskId, CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        await gateway.DeleteTaskAsync(accessToken, taskId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{taskId:guid}/activity")]
    public async Task<ActionResult<IReadOnlyList<TaskActivity>>> GetTaskActivity(Guid taskId, CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var activity = await gateway.GetTaskActivityAsync(accessToken, taskId, cancellationToken);
        return Ok(activity);
    }

    [HttpPatch("{taskId:guid}/labels")]
    public async Task<ActionResult<TaskItem>> UpdateTaskLabels(Guid taskId, [FromBody] UpdateTaskLabelsRequest request, CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var labelIds = request.LabelIds ?? [];
        var updated = await gateway.UpdateTaskLabelsAsync(accessToken, taskId, labelIds, cancellationToken);
        return Ok(updated);
    }

    [HttpGet("{taskId:guid}/comments")]
    public async Task<ActionResult<IReadOnlyList<TaskComment>>> GetTaskComments(Guid taskId, CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var comments = await gateway.GetTaskCommentsAsync(accessToken, taskId, cancellationToken);
        return Ok(comments);
    }

    [HttpPost("{taskId:guid}/comments")]
    public async Task<ActionResult<TaskComment>> CreateTaskComment(Guid taskId, [FromBody] CreateTaskCommentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return BadRequest("Comment body is required.");
        }

        if (request.Body.Trim().Length > 4000)
        {
            return BadRequest("Comment is too long.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var created = await gateway.CreateTaskCommentAsync(accessToken, taskId, request.Body, cancellationToken);
        return Ok(created);
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
