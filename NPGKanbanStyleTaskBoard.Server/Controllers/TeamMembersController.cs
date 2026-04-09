using Microsoft.AspNetCore.Mvc;
using NPGKanbanStyleTaskBoard.Server.Models;
using NPGKanbanStyleTaskBoard.Server.Services;

namespace NPGKanbanStyleTaskBoard.Server.Controllers;

[ApiController]
[Route("api/team-members")]
public sealed class TeamMembersController(ISupabaseTasksGateway gateway) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TeamMember>>> GetTeamMembers(CancellationToken cancellationToken)
    {
        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var members = await gateway.GetTeamMembersAsync(accessToken, cancellationToken);
        return Ok(members);
    }

    [HttpPost]
    public async Task<ActionResult<TeamMember>> CreateTeamMember([FromBody] CreateTeamMemberRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Member name is required.");
        }

        var accessToken = ReadAccessToken();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized("Missing bearer token.");
        }

        var created = await gateway.CreateTeamMemberAsync(accessToken, request, cancellationToken);
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
