using System;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Organisations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organisations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Host = table.Column<string>(type: "character varying(253)", maxLength: 253, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ShortName = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ChapterLabelSingular = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ChapterLabelPlural = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    SuspendedReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SuspendedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organisations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Organisations_Host",
                table: "Organisations",
                column: "Host",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Organisations_Slug",
                table: "Organisations",
                column: "Slug",
                unique: true);

            // FaithTech is the first organisation (L2-151 AC1); later migrations stamp existing rows with its id.
            migrationBuilder.InsertData(
                table: "Organisations",
                columns: ["Id", "Slug", "Host", "Name", "ShortName", "ChapterLabelSingular", "ChapterLabelPlural", "Status", "CreatedAtUtc"],
                values: new object[]
                {
                    FaithTechSeed.OrganisationId, FaithTechSeed.Slug, FaithTechSeed.Host, FaithTechSeed.Name, FaithTechSeed.ShortName,
                    FaithTechSeed.ChapterLabelSingular, FaithTechSeed.ChapterLabelPlural, "Active", FaithTechSeed.CreatedAtUtc,
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Organisations");
        }
    }
}
