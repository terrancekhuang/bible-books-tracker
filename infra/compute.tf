resource "hcloud_ssh_key" "deploy" {
  name       = "bible-tracker-deploy"
  public_key = tls_private_key.deploy.public_key_openssh
}

resource "hcloud_ssh_key" "admin" {
  count      = var.admin_ssh_key != "" ? 1 : 0
  name       = "bible-tracker-admin"
  public_key = var.admin_ssh_key
}

# Reserved public IP — survives server rebuilds
resource "hcloud_primary_ip" "main" {
  name        = "bible-tracker-ip"
  type        = "ipv4"
  location    = var.location
  auto_delete = false
}

resource "hcloud_server" "app" {
  name         = "bible-tracker"
  server_type  = var.server_type
  image        = "ubuntu-22.04"
  location     = var.location
  firewall_ids = [hcloud_firewall.app.id]
  user_data    = file("${path.module}/cloud-init.yaml")

  ssh_keys = var.admin_ssh_key != "" ? [
    hcloud_ssh_key.deploy.id,
    hcloud_ssh_key.admin[0].id,
  ] : [hcloud_ssh_key.deploy.id]

  public_net {
    ipv4_enabled = true
    ipv4         = hcloud_primary_ip.main.id
    ipv6_enabled = true
  }
}
