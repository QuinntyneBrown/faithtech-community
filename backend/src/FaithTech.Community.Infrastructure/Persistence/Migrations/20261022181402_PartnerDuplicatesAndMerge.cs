using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PartnerDuplicatesAndMerge : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MergedFromPartnerId",
                table: "PartnerStageChanges",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAtUtc",
                table: "Partners",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MergedAtUtc",
                table: "Partners",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MergedById",
                table: "Partners",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MergedIntoId",
                table: "Partners",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "Partners",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "MergedFromPartnerId",
                table: "PartnerActivities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RelatedPartnerId",
                table: "PartnerActivities",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PartnerDuplicateDismissals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LowerPartnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    HigherPartnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    DismissedById = table.Column<Guid>(type: "uuid", nullable: false),
                    DismissedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartnerDuplicateDismissals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartnerDuplicateDismissals_Partners_HigherPartnerId",
                        column: x => x.HigherPartnerId,
                        principalTable: "Partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PartnerDuplicateDismissals_Partners_LowerPartnerId",
                        column: x => x.LowerPartnerId,
                        principalTable: "Partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartnerStageChanges_MergedFromPartnerId",
                table: "PartnerStageChanges",
                column: "MergedFromPartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Partners_ArchivedAtUtc",
                table: "Partners",
                column: "ArchivedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerActivities_MergedFromPartnerId",
                table: "PartnerActivities",
                column: "MergedFromPartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_HigherPartnerId",
                table: "PartnerDuplicateDismissals",
                column: "HigherPartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerDuplicateDismissals_LowerPartnerId_HigherPartnerId",
                table: "PartnerDuplicateDismissals",
                columns: new[] { "LowerPartnerId", "HigherPartnerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PartnerDuplicateDismissals");

            migrationBuilder.DropIndex(
                name: "IX_PartnerStageChanges_MergedFromPartnerId",
                table: "PartnerStageChanges");

            migrationBuilder.DropIndex(
                name: "IX_Partners_ArchivedAtUtc",
                table: "Partners");

            migrationBuilder.DropIndex(
                name: "IX_PartnerActivities_MergedFromPartnerId",
                table: "PartnerActivities");

            migrationBuilder.DropColumn(
                name: "MergedFromPartnerId",
                table: "PartnerStageChanges");

            migrationBuilder.DropColumn(
                name: "ArchivedAtUtc",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "MergedAtUtc",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "MergedById",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "MergedIntoId",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "MergedFromPartnerId",
                table: "PartnerActivities");

            migrationBuilder.DropColumn(
                name: "RelatedPartnerId",
                table: "PartnerActivities");
        }
    }
}
