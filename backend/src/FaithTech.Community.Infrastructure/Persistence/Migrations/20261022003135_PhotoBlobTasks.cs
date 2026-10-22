using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PhotoBlobTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsStored",
                table: "ProfilePhotos",
                type: "boolean",
                nullable: false,
                // Every photo uploaded before this change has its blob.
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "PhotoBlobTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Work = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PhotoId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlobName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: true),
                    ContentType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoBlobTasks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoBlobTasks_NextAttemptAt",
                table: "PhotoBlobTasks",
                column: "NextAttemptAt");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoBlobTasks_PhotoId",
                table: "PhotoBlobTasks",
                column: "PhotoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotoBlobTasks");

            migrationBuilder.DropColumn(
                name: "IsStored",
                table: "ProfilePhotos");
        }
    }
}
