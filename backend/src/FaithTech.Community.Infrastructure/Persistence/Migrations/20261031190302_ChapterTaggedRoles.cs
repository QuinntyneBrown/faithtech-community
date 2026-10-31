using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Role assignments get their own id and an optional chapter tag (L2-141 AC3), held once per profile, role and tag
    /// with null tags counted as equal (L2-138 AC7).
    /// </summary>
    public partial class ChapterTaggedRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles");

            // Every existing assignment gets its own id before the id becomes the key; all of them are untagged.
            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "ProfileRoles",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("UPDATE \"ProfileRoles\" SET \"Id\" = gen_random_uuid();");

            migrationBuilder.AlterColumn<Guid>(
                name: "Id",
                table: "ProfileRoles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ChapterId",
                table: "ProfileRoles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileRoles_ChapterId",
                table: "ProfileRoles",
                column: "ChapterId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileRoles_ProfileId_RoleDefinitionId_ChapterId",
                table: "ProfileRoles",
                columns: new[] { "ProfileId", "RoleDefinitionId", "ChapterId" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileRoles_Chapters_ChapterId",
                table: "ProfileRoles",
                column: "ChapterId",
                principalTable: "Chapters",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileRoles_Chapters_ChapterId",
                table: "ProfileRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles");

            migrationBuilder.DropIndex(
                name: "IX_ProfileRoles_ChapterId",
                table: "ProfileRoles");

            migrationBuilder.DropIndex(
                name: "IX_ProfileRoles_ProfileId_RoleDefinitionId_ChapterId",
                table: "ProfileRoles");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "ProfileRoles");

            migrationBuilder.DropColumn(
                name: "ChapterId",
                table: "ProfileRoles");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProfileRoles",
                table: "ProfileRoles",
                columns: new[] { "ProfileId", "RoleDefinitionId" });
        }
    }
}
