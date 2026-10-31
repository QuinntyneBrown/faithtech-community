using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OrganisationAdminRosters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemAdminRosters");

            migrationBuilder.CreateTable(
                name: "OrganisationAdminRosters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganisationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    LeaseHolder = table.Column<Guid>(type: "uuid", nullable: true),
                    LeaseExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganisationAdminRosters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganisationAdminRosters_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganisationAdminRosters_OrganisationId",
                table: "OrganisationAdminRosters",
                column: "OrganisationId",
                unique: true);

            // The singleton becomes FaithTech's row, and every other organisation already provisioned gets its own
            // (L2-139 AC2, seed design step 7). A lease in flight on the singleton is dropped: it lasts 30 seconds.
            migrationBuilder.Sql(
                """
                INSERT INTO "OrganisationAdminRosters" ("Id", "OrganisationId", "Version")
                SELECT gen_random_uuid(), o."Id", gen_random_uuid() FROM "Organisations" o;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganisationAdminRosters");

            migrationBuilder.CreateTable(
                name: "SystemAdminRosters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LeaseExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LeaseHolder = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemAdminRosters", x => x.Id);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO "SystemAdminRosters" ("Id", "Version")
                VALUES ('5a3c1d2e-0000-4000-8000-000000000001', gen_random_uuid());
                """);
        }
    }
}
