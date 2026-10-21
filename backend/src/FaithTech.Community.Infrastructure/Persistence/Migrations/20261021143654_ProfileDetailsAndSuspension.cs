using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfileDetailsAndSuspension : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AnnouncementEmailsOptedOut",
                table: "Profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Bio",
                table: "Profiles",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeCity",
                table: "Profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SuspendedAtUtc",
                table: "Profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuspendedReason",
                table: "Profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnouncementEmailsOptedOut",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Bio",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "HomeCity",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "SuspendedAtUtc",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "SuspendedReason",
                table: "Profiles");
        }
    }
}
