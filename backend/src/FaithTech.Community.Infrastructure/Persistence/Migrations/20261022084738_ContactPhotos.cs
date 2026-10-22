using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaithTech.Community.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ContactPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ContactPhotoLeases",
                columns: table => new
                {
                    ContactId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    Holder = table.Column<Guid>(type: "uuid", nullable: true),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContactPhotoLeases", x => x.ContactId);
                    table.ForeignKey(
                        name: "FK_ContactPhotoLeases_Contacts_ContactId",
                        column: x => x.ContactId,
                        principalTable: "Contacts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Every existing contact needs its lease row: the lease is a required part of a contact.
            migrationBuilder.Sql(
                "INSERT INTO \"ContactPhotoLeases\" (\"ContactId\", \"Version\") SELECT \"Id\", gen_random_uuid() FROM \"Contacts\";");

            migrationBuilder.CreateTable(
                name: "ContactPhotos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BlobName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AltText = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IsFeatured = table.Column<bool>(type: "boolean", nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsStored = table.Column<bool>(type: "boolean", nullable: false),
                    ContactId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContactPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContactPhotos_Contacts_ContactId",
                        column: x => x.ContactId,
                        principalTable: "Contacts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContactPhotos_ContactId",
                table: "ContactPhotos",
                column: "ContactId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContactPhotoLeases");

            migrationBuilder.DropTable(
                name: "ContactPhotos");
        }
    }
}
