output "server_ip" {
  description = "Reserved public IP — use this as your DNS A record target"
  value       = hcloud_primary_ip.main.ip_address
}

output "ssh_command" {
  description = "SSH into the server with the generated deploy key"
  value       = "ssh -i infra/deploy_key root@${hcloud_primary_ip.main.ip_address}"
}

output "deploy_public_key" {
  description = "Public half of the generated deploy key — for reference"
  value       = tls_private_key.deploy.public_key_openssh
  sensitive   = false
}

output "backup_bucket_name" {
  description = "R2 bucket name for DB backups — use as BACKUP_S3_BUCKET in .env"
  value       = cloudflare_r2_bucket.db_backups.name
}

output "backup_s3_endpoint" {
  description = "R2 S3-compatible endpoint — use as BACKUP_S3_ENDPOINT in .env"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}
