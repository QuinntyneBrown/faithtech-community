using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SharesAndAudiencesReferenceDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Resource and note share roles, and announcement role audiences, become references to the organisation's
            // definition whose key is the former role value (L2-151 AC4). A value no definition names cannot be kept.
            migrationBuilder.AddColumn<Guid>(name: "RoleDefinitionId", table: "ResourceShareRoles", type: "uuid", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "RoleDefinitionId", table: "NoteShareRoles", type: "uuid", nullable: true);
            migrationBuilder.AlterColumn<string>(
                name: "AudienceRoles",
                table: "Announcements",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.Sql("""
                UPDATE "ResourceShareRoles" s
                SET "RoleDefinitionId" = d."Id"
                FROM "Resources" r
                JOIN "RoleDefinitions" d ON d."OrganisationId" = r."OrganisationId"
                WHERE r."Id" = s."ResourceId" AND d."Key" = s."Role";

                DELETE FROM "ResourceShareRoles" WHERE "RoleDefinitionId" IS NULL;

                UPDATE "NoteShareRoles" s
                SET "RoleDefinitionId" = d."Id"
                FROM "NotePages" p
                JOIN "RoleDefinitions" d ON d."OrganisationId" = p."OrganisationId"
                WHERE p."Id" = s."PageId" AND d."Key" = s."Role";

                DELETE FROM "NoteShareRoles" WHERE "RoleDefinitionId" IS NULL;

                UPDATE "Announcements" a
                SET "AudienceRoles" = COALESCE((
                    SELECT string_agg(d."Id"::text, ',' ORDER BY d."Id"::text)
                    FROM unnest(string_to_array(a."AudienceRoles", ',')) AS k(key)
                    JOIN "RoleDefinitions" d ON d."OrganisationId" = a."OrganisationId" AND d."Key" = k.key), '')
                WHERE a."AudienceRoles" <> '';
                """);

            migrationBuilder.DropPrimaryKey(name: "PK_ResourceShareRoles", table: "ResourceShareRoles");
            migrationBuilder.DropIndex(name: "IX_NoteShareRoles_PageId_Role", table: "NoteShareRoles");
            migrationBuilder.DropColumn(name: "Role", table: "ResourceShareRoles");
            migrationBuilder.DropColumn(name: "Role", table: "NoteShareRoles");
            migrationBuilder.AlterColumn<Guid>(
                name: "RoleDefinitionId", table: "ResourceShareRoles", type: "uuid", nullable: false,
                oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);
            migrationBuilder.AlterColumn<Guid>(
                name: "RoleDefinitionId", table: "NoteShareRoles", type: "uuid", nullable: false,
                oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_ResourceShareRoles",
                table: "ResourceShareRoles",
                columns: new[] { "ResourceId", "RoleDefinitionId" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceShareRoles_RoleDefinitionId",
                table: "ResourceShareRoles",
                column: "RoleDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_NoteShareRoles_PageId_RoleDefinitionId",
                table: "NoteShareRoles",
                columns: new[] { "PageId", "RoleDefinitionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NoteShareRoles_RoleDefinitionId",
                table: "NoteShareRoles",
                column: "RoleDefinitionId");

            migrationBuilder.AddForeignKey(
                name: "FK_NoteShareRoles_RoleDefinitions_RoleDefinitionId",
                table: "NoteShareRoles",
                column: "RoleDefinitionId",
                principalTable: "RoleDefinitions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ResourceShareRoles_RoleDefinitions_RoleDefinitionId",
                table: "ResourceShareRoles",
                column: "RoleDefinitionId",
                principalTable: "RoleDefinitions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_NoteShareRoles_RoleDefinitions_RoleDefinitionId", table: "NoteShareRoles");
            migrationBuilder.DropForeignKey(name: "FK_ResourceShareRoles_RoleDefinitions_RoleDefinitionId", table: "ResourceShareRoles");
            migrationBuilder.DropPrimaryKey(name: "PK_ResourceShareRoles", table: "ResourceShareRoles");
            migrationBuilder.DropIndex(name: "IX_ResourceShareRoles_RoleDefinitionId", table: "ResourceShareRoles");
            migrationBuilder.DropIndex(name: "IX_NoteShareRoles_PageId_RoleDefinitionId", table: "NoteShareRoles");
            migrationBuilder.DropIndex(name: "IX_NoteShareRoles_RoleDefinitionId", table: "NoteShareRoles");

            migrationBuilder.AddColumn<string>(name: "Role", table: "ResourceShareRoles", type: "character varying(32)", maxLength: 32, nullable: true);
            migrationBuilder.AddColumn<string>(name: "Role", table: "NoteShareRoles", type: "character varying(32)", maxLength: 32, nullable: true);

            // Back to the former values: each definition's key, for the definitions a former value names.
            migrationBuilder.Sql("""
                UPDATE "ResourceShareRoles" s SET "Role" = d."Key" FROM "RoleDefinitions" d WHERE d."Id" = s."RoleDefinitionId";
                UPDATE "NoteShareRoles" s SET "Role" = d."Key" FROM "RoleDefinitions" d WHERE d."Id" = s."RoleDefinitionId";
                DELETE FROM "ResourceShareRoles" WHERE "Role" IS NULL OR "Role" NOT IN ('CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead', 'Staff', 'Volunteer', 'ProductEngineer', 'Attendee', 'SystemAdmin');
                DELETE FROM "NoteShareRoles" WHERE "Role" IS NULL OR "Role" NOT IN ('CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead', 'Staff', 'Volunteer', 'ProductEngineer', 'Attendee', 'SystemAdmin');

                UPDATE "Announcements" a
                SET "AudienceRoles" = COALESCE((
                    SELECT string_agg(d."Key", ',' ORDER BY d."Key")
                    FROM unnest(string_to_array(a."AudienceRoles", ',')) AS k(id)
                    JOIN "RoleDefinitions" d ON d."Id"::text = k.id), '')
                WHERE a."AudienceRoles" <> '';
                """);

            migrationBuilder.DropColumn(name: "RoleDefinitionId", table: "ResourceShareRoles");
            migrationBuilder.DropColumn(name: "RoleDefinitionId", table: "NoteShareRoles");
            migrationBuilder.AlterColumn<string>(
                name: "Role", table: "ResourceShareRoles", type: "character varying(32)", maxLength: 32, nullable: false,
                oldClrType: typeof(string), oldType: "character varying(32)", oldMaxLength: 32, oldNullable: true);
            migrationBuilder.AlterColumn<string>(
                name: "Role", table: "NoteShareRoles", type: "character varying(32)", maxLength: 32, nullable: false,
                oldClrType: typeof(string), oldType: "character varying(32)", oldMaxLength: 32, oldNullable: true);
            migrationBuilder.AlterColumn<string>(
                name: "AudienceRoles",
                table: "Announcements",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(2000)",
                oldMaxLength: 2000);

            migrationBuilder.AddPrimaryKey(name: "PK_ResourceShareRoles", table: "ResourceShareRoles", columns: new[] { "ResourceId", "Role" });
            migrationBuilder.CreateIndex(name: "IX_NoteShareRoles_PageId_Role", table: "NoteShareRoles", columns: new[] { "PageId", "Role" }, unique: true);
        }
    }
}
