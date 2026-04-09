# ASP.NET Core 8 API for Render (Docker provides dotnet CLI; native Node env does not).
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish "NPGKanbanStyleTaskBoard.Server/NPGKanbanStyleTaskBoard.Server.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
# Render sets PORT at runtime; Program.cs listens on http://0.0.0.0:$PORT
EXPOSE 10000
ENTRYPOINT ["dotnet", "NPGKanbanStyleTaskBoard.Server.dll"]
