using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventHubs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventHubs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    TemplateKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UpdateBanner = table.Column<string>(type: "character varying(280)", maxLength: 280, nullable: true),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventHubs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventHubs_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventHubs_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HubSections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventHubId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Visible = table.Column<bool>(type: "boolean", nullable: false),
                    Content = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HubSections_EventHubs_EventHubId",
                        column: x => x.EventHubId,
                        principalTable: "EventHubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubSections_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventHubs_EventId",
                table: "EventHubs",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_EventHubs_OrganisationId",
                table: "EventHubs",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_EventHubs_OrganisationId_EventId",
                table: "EventHubs",
                columns: new[] { "OrganisationId", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubSections_EventHubId_Kind",
                table: "HubSections",
                columns: new[] { "EventHubId", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubSections_OrganisationId",
                table: "HubSections",
                column: "OrganisationId");

            // FaithTech's City Lead and Event Lead gain ManageEventHubs (L2-155 AC1, L2-151 AC2), only where missing.
            migrationBuilder.Sql(
                """
                UPDATE "RoleDefinitions" SET "Capabilities" = array_append("Capabilities", 'ManageEventHubs')
                WHERE "Id" IN ('0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7001', '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7002')
                  AND NOT ('ManageEventHubs' = ANY("Capabilities"));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "RoleDefinitions" SET "Capabilities" = array_remove("Capabilities", 'ManageEventHubs');
                """);

            migrationBuilder.DropTable(
                name: "HubSections");

            migrationBuilder.DropTable(
                name: "EventHubs");
        }
    }
}
