using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfileRolesReferenceDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Each held role becomes a reference to the organisation's definition whose key is the former role value
            // (L2-151 AC4). A value no definition in the profile's organisation names cannot be kept and is dropped.
            migrationBuilder.AddColumn<Guid>(
                name: "RoleDefinitionId",
                table: "ProfileRoles",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "ProfileRoles" pr
                SET "RoleDefinitionId" = d."Id"
                FROM "Profiles" p
                JOIN "RoleDefinitions" d ON d."OrganisationId" = p."OrganisationId"
                WHERE p."Id" = pr."ProfileId" AND d."Key" = pr."Role";

                DELETE FROM "ProfileRoles" WHERE "RoleDefinitionId" IS NULL;
                """);

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "ProfileRoles");

            migrationBuilder.AlterColumn<Guid>(
                name: "RoleDefinitionId",
                table: "ProfileRoles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles",
                columns: new[] { "ProfileId", "RoleDefinitionId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfileRoles_RoleDefinitionId",
                table: "ProfileRoles",
                column: "RoleDefinitionId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileRoles_RoleDefinitions_RoleDefinitionId",
                table: "ProfileRoles",
                column: "RoleDefinitionId",
                principalTable: "RoleDefinitions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileRoles_RoleDefinitions_RoleDefinitionId",
                table: "ProfileRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles");

            migrationBuilder.DropIndex(
                name: "IX_ProfileRoles_RoleDefinitionId",
                table: "ProfileRoles");

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "ProfileRoles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            // Back to the former value: the definition's key, for the definitions a former value names.
            migrationBuilder.Sql("""
                UPDATE "ProfileRoles" pr
                SET "Role" = d."Key"
                FROM "RoleDefinitions" d
                WHERE d."Id" = pr."RoleDefinitionId";

                DELETE FROM "ProfileRoles"
                WHERE "Role" IS NULL OR "Role" NOT IN ('CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead', 'Staff',
                    'Volunteer', 'ProductEngineer', 'Attendee', 'SystemAdmin');
                """);

            migrationBuilder.DropColumn(
                name: "RoleDefinitionId",
                table: "ProfileRoles");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "ProfileRoles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles",
                columns: new[] { "ProfileId", "Role" });
        }
    }
}
