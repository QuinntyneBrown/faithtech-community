using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PhotoLeases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhotoLeases",
                columns: table => new
                {
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    Holder = table.Column<Guid>(type: "uuid", nullable: true),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoLeases", x => x.ProfileId);
                    table.ForeignKey(
                        name: "FK_PhotoLeases_Profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "Profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Every profile owns exactly one lease; new profiles get theirs when they are created.
            migrationBuilder.Sql(
                "INSERT INTO \"PhotoLeases\" (\"ProfileId\", \"Version\") SELECT \"Id\", gen_random_uuid() FROM \"Profiles\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotoLeases");
        }
    }
}
