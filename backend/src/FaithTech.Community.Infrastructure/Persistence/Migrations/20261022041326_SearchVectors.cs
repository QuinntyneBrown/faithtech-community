using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SearchVectors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "WorkItems",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", ''))",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Profiles",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(\"Name\", '') || ' ' || coalesce(\"HomeCity\", '') || ' ' || coalesce(\"Bio\", ''))",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Partners",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(\"Name\", '') || ' ' || coalesce(\"Offering\", '') || ' ' || coalesce(\"ContactName\", '') || ' ' || coalesce(\"Notes\", ''))",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Contacts",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(\"Name\", '') || ' ' || coalesce(\"Email\", '') || ' ' || coalesce(\"Organization\", '') || ' ' || coalesce(\"City\", ''))",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_SearchVector",
                table: "WorkItems",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_SearchVector",
                table: "Profiles",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Partners_SearchVector",
                table: "Partners",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_SearchVector",
                table: "Contacts",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkItems_SearchVector",
                table: "WorkItems");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_SearchVector",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_Partners_SearchVector",
                table: "Partners");

            migrationBuilder.DropIndex(
                name: "IX_Contacts_SearchVector",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                table: "Contacts");
        }
    }
}
