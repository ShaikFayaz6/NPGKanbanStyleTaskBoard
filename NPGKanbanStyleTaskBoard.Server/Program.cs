using NPGKanbanStyleTaskBoard.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<SupabaseOptions>(builder.Configuration.GetSection(SupabaseOptions.SectionName));
builder.Services.AddHttpClient<ISupabaseTasksGateway, SupabaseTasksGateway>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// Swagger: enable in all environments so hosted API is easy to verify (tighten for production if needed).
app.UseSwagger();
app.UseSwaggerUI();

// Hosted platforms (e.g. Render) terminate TLS; app listens on HTTP behind the proxy.
var port = Environment.GetEnvironmentVariable("PORT");
if (string.IsNullOrEmpty(port))
{
    app.UseHttpsRedirection();
}

app.UseAuthorization();

// Hosted API has no SPA files in wwwroot; "/" would otherwise 404. Swagger is the quick health/demo entry.
app.MapGet("/", () => Results.Redirect("/swagger"));

app.MapControllers();

app.MapFallbackToFile("/index.html");

// Render and similar hosts inject PORT; local dev uses Kestrel defaults from launchSettings or localhost below.
if (!string.IsNullOrEmpty(port))
{
    app.Run($"http://0.0.0.0:{port}");
}
else
{
    app.Run("https://localhost:7056;http://localhost:5180");
}
