using Microsoft.AspNetCore.Mvc;
using NPGKanbanStyleTaskBoard.Server.Models;
using NPGKanbanStyleTaskBoard.Server.Services;

namespace NPGKanbanStyleTaskBoard.Server.Controllers;

[ApiController]
[Route("api/labels")]
public sealed class LabelsController(ISupabaseTasksGateway gateway) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LabelItem>>> GetLabels(CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var labels = await gateway.GetLabelsAsync(accessToken, cancellationToken);
        return Ok(labels);
    }

    [HttpPost]
    public async Task<ActionResult<LabelItem>> CreateLabel([FromBody] CreateLabelRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Label name is required.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var created = await gateway.CreateLabelAsync(accessToken, request, cancellationToken);
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
