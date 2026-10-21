using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlanningPokerSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_PokerVotes",
                table: "PokerVotes");

            migrationBuilder.AddColumn<int>(
                name: "Id",
                table: "PokerVotes",
                type: "integer",
                nullable: false,
                defaultValue: 0)
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<bool>(
                name: "IsClosed",
                table: "PokerSessions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LastPoints",
                table: "PokerSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LastStoryId",
                table: "PokerSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_PokerVotes",
                table: "PokerVotes",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_PokerVotes_SessionId_ProfileId",
                table: "PokerVotes",
                columns: new[] { "SessionId", "ProfileId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_PokerVotes",
                table: "PokerVotes");

            migrationBuilder.DropIndex(
                name: "IX_PokerVotes_SessionId_ProfileId",
                table: "PokerVotes");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "PokerVotes");

            migrationBuilder.DropColumn(
                name: "IsClosed",
                table: "PokerSessions");

            migrationBuilder.DropColumn(
                name: "LastPoints",
                table: "PokerSessions");

            migrationBuilder.DropColumn(
                name: "LastStoryId",
                table: "PokerSessions");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PokerVotes",
                table: "PokerVotes",
                columns: new[] { "SessionId", "ProfileId" });
        }
    }
}
