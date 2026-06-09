resource "cloudflare_r2_bucket" "db_backups" {
  account_id = var.cloudflare_account_id
  name       = "bible-books-tracker-db-backups"
  location   = "WNAM" # Western North America — closest to hil/ash servers
}
