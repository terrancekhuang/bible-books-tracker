resource "hcloud_ssh_key" "deploy" {
  name       = "bible-books-tracker-deploy"
  public_key = tls_private_key.deploy.public_key_openssh
}

resource "hcloud_ssh_key" "admin" {
  count      = var.admin_ssh_key != "" ? 1 : 0
  name       = "bible-books-tracker-admin"
  public_key = var.admin_ssh_key
}

# Reserved public IP — survives server rebuilds
resource "hcloud_primary_ip" "main" {
  name        = "bible-books-tracker-ip"
  type        = "ipv4"
  location    = var.location
  auto_delete = false
}

resource "hcloud_server" "app" {
  name         = "bible-books-tracker"
  server_type  = var.server_type
  image        = "ubuntu-22.04"
  location     = var.location
  firewall_ids = [hcloud_firewall.app.id]

  ssh_keys = var.admin_ssh_key != "" ? [
    hcloud_ssh_key.deploy.id,
    hcloud_ssh_key.admin[0].id,
  ] : [hcloud_ssh_key.deploy.id]

  public_net {
    ipv4_enabled = true
    ipv4         = hcloud_primary_ip.main.id
    ipv6_enabled = true
  }

  connection {
    type        = "ssh"
    user        = "root"
    private_key = tls_private_key.deploy.private_key_openssh
    host        = hcloud_primary_ip.main.ip_address
  }

  provisioner "remote-exec" {
    inline = [
      "apt-get update -q && apt-get install -y -q curl git ufw nginx certbot python3-certbot-nginx",
      "curl -fsSL https://get.docker.com | sh",
      "systemctl enable --now docker",
      "ufw default deny incoming",
      "ufw default allow outgoing",
      "ufw allow OpenSSH",
      "ufw allow 'Nginx Full'",
      "ufw --force enable",
      "mkdir -p /srv/apps/bible-books-tracker",
    ]
  }

  provisioner "file" {
    source      = var.env_file
    destination = "/srv/apps/bible-books-tracker/.env"
  }
}
