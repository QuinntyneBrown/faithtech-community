using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmailOutboxFailedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_SentAt_NextAttemptAt",
                table: "OutboxMessages");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FailedAt",
                table: "OutboxMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_SentAt_FailedAt_NextAttemptAt",
                table: "OutboxMessages",
                columns: new[] { "SentAt", "FailedAt", "NextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_SentAt_FailedAt_NextAttemptAt",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "FailedAt",
                table: "OutboxMessages");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_SentAt_NextAttemptAt",
                table: "OutboxMessages",
                columns: new[] { "SentAt", "NextAttemptAt" });
        }
    }
}
