using Microsoft.AspNetCore.Mvc;
using NPGKanbanStyleTaskBoard.Server.Models;
using NPGKanbanStyleTaskBoard.Server.Services;

namespace NPGKanbanStyleTaskBoard.Server.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController(ISupabaseTasksGateway gateway) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TagItem>>> GetTags(CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var tags = await gateway.GetTagsAsync(accessToken, cancellationToken);
        return Ok(tags);
    }

    [HttpPost]
    public async Task<ActionResult<TagItem>> CreateTag([FromBody] CreateTagRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Tag name is required.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var created = await gateway.CreateTagAsync(accessToken, request, cancellationToken);
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
