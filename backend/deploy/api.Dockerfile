# syntax=docker/dockerfile:1
# The production API image (ADR 0026): the API, the identity server and both Angular production builds, served by
# host behind the private-preview wall. Build from the repository root:
#   docker build -f backend/deploy/api.Dockerfile -t faithtech-community-api .

FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
# --ignore-scripts skips the husky "prepare" hook, which needs the git checkout.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend/ ./
# Production configurations: COMMUNITY_ORIGIN https://app.faithtech.community, session hint domain
# faithtech.community, hashed file names, no source maps (angular.json).
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src/backend
COPY backend/global.json backend/Directory.Build.props backend/Directory.Packages.props ./
COPY backend/src/ ./src/
# Infrastructure embeds the design tokens for the HTML emails.
COPY docs/design-system/tokens/tokens.css /src/docs/design-system/tokens/tokens.css
RUN dotnet publish src/FaithTech.Community.Api/FaithTech.Community.Api.csproj -c Release -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /out ./
COPY --from=frontend /src/frontend/dist/faithtech-community/browser ./sites/app
COPY --from=frontend /src/frontend/dist/marketing/browser ./sites/www
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    StaticSites__AppRoot=/app/sites/app \
    StaticSites__MarketingRoot=/app/sites/www \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
EXPOSE 8080
# The non-root user the .NET images provide.
USER $APP_UID
ENTRYPOINT ["dotnet", "FaithTech.Community.Api.dll"]
