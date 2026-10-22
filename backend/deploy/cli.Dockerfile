# syntax=docker/dockerfile:1
# The Cli image: database migrate and seed before each rollout (the API never migrates itself), plus the wall's
# wall-hash and wall-key. Build from the repository root:
#   docker build -f backend/deploy/cli.Dockerfile -t faithtech-community-cli .
#   docker run --rm -e ConnectionStrings__Community=... -e WebApp__Origin=https://app.faithtech.community faithtech-community-cli migrate

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src/backend
COPY backend/global.json backend/Directory.Build.props backend/Directory.Packages.props ./
COPY backend/src/ ./src/
# Infrastructure embeds the design tokens for the HTML emails.
COPY docs/design-system/tokens/tokens.css /src/docs/design-system/tokens/tokens.css
RUN dotnet publish src/FaithTech.Community.Cli/FaithTech.Community.Cli.csproj -c Release -o /out /p:UseAppHost=false

# Infrastructure uses ASP.NET Core Identity and Data Protection, so the Cli needs the ASP.NET Core runtime.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /out ./
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
USER $APP_UID
ENTRYPOINT ["dotnet", "FaithTech.Community.Cli.dll"]
