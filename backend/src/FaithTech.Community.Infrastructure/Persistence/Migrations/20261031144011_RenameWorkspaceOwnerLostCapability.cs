using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameWorkspaceOwnerLostCapability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The kind is stored by name; a workspace owner now loses a capability, not a role (L2-139 AC4).
            migrationBuilder.Sql(
                """
                UPDATE "Notifications" SET "Kind" = 'WorkspaceOwnerLostCapability' WHERE "Kind" = 'WorkspaceOwnerLostCityLead';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "Notifications" SET "Kind" = 'WorkspaceOwnerLostCityLead' WHERE "Kind" = 'WorkspaceOwnerLostCapability';
                """);
        }
    }
}
