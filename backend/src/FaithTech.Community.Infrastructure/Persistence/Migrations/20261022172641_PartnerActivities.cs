using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PartnerActivities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PartnerActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PartnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    OccurredOn = table.Column<DateOnly>(type: "date", nullable: false),
                    OccurredAt = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    NextStep = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    NextStepDue = table.Column<DateOnly>(type: "date", nullable: true),
                    LoggedById = table.Column<Guid>(type: "uuid", nullable: false),
                    LoggedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FromStage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    ToStage = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    StageChangeId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartnerActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartnerActivities_Partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "Partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartnerActivities_PartnerId_NextStep",
                table: "PartnerActivities",
                column: "PartnerId",
                filter: "\"NextStep\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PartnerActivities_PartnerId_OccurredOn_OccurredAt_LoggedAtU~",
                table: "PartnerActivities",
                columns: new[] { "PartnerId", "OccurredOn", "OccurredAt", "LoggedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PartnerActivities_StageChangeId",
                table: "PartnerActivities",
                column: "StageChangeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PartnerActivities");
        }
    }
}
