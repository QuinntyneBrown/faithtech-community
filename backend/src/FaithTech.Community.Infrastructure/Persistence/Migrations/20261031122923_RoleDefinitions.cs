using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RoleDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoleDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Capabilities = table.Column<string[]>(type: "text[]", nullable: false),
                    ShowOnTeam = table.Column<bool>(type: "boolean", nullable: false),
                    ChapterScopable = table.Column<bool>(type: "boolean", nullable: false),
                    IsOversight = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    ArchivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleDefinitions_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoleGrantRules",
                columns: table => new
                {
                    GrantorRoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrantableRoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleGrantRules", x => new { x.GrantorRoleId, x.GrantableRoleId });
                    table.ForeignKey(
                        name: "FK_RoleGrantRules_RoleDefinitions_GrantorRoleId",
                        column: x => x.GrantorRoleId,
                        principalTable: "RoleDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoleDefinitions_OrganisationId",
                table: "RoleDefinitions",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleDefinitions_OrganisationId_Key",
                table: "RoleDefinitions",
                columns: new[] { "OrganisationId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoleGrantRules_GrantableRoleId",
                table: "RoleGrantRules",
                column: "GrantableRoleId");

            // FaithTech's nine roles and City Lead's grant rules (L2-151 AC2), so the next migration can map every former
            // role value to the definition of the same name; the seeder finds them by key and leaves them alone.
            foreach (var definition in FaithTechSeed.RoleDefinitions())
            {
                migrationBuilder.InsertData(
                    table: "RoleDefinitions",
                    columns: ["Id", "OrganisationId", "Key", "Name", "Description", "Capabilities", "ShowOnTeam", "ChapterScopable", "IsOversight", "SortOrder"],
                    values: new object[]
                    {
                        definition.Id, FaithTechSeed.OrganisationId, definition.Key, definition.Name, definition.Description,
                        definition.Capabilities, definition.ShowOnTeam, definition.ChapterScopable, definition.IsOversight, definition.SortOrder,
                    });
            }

            foreach (var grant in FaithTechSeed.RoleDefinitions().SelectMany(d => d.Grants))
            {
                migrationBuilder.InsertData(
                    table: "RoleGrantRules",
                    columns: ["GrantorRoleId", "GrantableRoleId"],
                    values: new object[] { grant.GrantorRoleId, grant.GrantableRoleId });
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoleGrantRules");

            migrationBuilder.DropTable(
                name: "RoleDefinitions");
        }
    }
}
