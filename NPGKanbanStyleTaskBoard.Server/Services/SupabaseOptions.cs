namespace NPGKanbanStyleTaskBoard.Server.Services;

public sealed class SupabaseOptions
{
    public const string SectionName = "Supabase";
    public string Url { get; init; } = string.Empty;
    public string AnonKey { get; init; } = string.Empty;
}
