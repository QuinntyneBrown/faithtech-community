using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GuestRsvpCancelTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelTokenHash",
                table: "Rsvps",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Rsvps_CancelTokenHash",
                table: "Rsvps",
                column: "CancelTokenHash",
                unique: true,
                filter: "\"CancelTokenHash\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Rsvps_CancelTokenHash",
                table: "Rsvps");

            migrationBuilder.DropColumn(
                name: "CancelTokenHash",
                table: "Rsvps");
        }
    }
}
