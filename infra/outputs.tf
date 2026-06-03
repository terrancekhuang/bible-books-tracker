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
