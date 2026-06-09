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

  # 1. Create app dir so the file provisioner below has a destination
  provisioner "remote-exec" {
    inline = ["mkdir -p /srv/apps/bible-books-tracker"]
  }

  # 2. Upload .env so backup setup can read credentials
  provisioner "file" {
    source      = var.env_file
    destination = "/srv/apps/bible-books-tracker/.env"
  }

  # 3. Install packages, configure system, set up backup infrastructure
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
      # Install rclone
      "curl -fsSL https://rclone.org/install.sh | bash",
      # Create backup dirs and log
      "mkdir -p /srv/backups/bible-books-tracker && touch /var/log/bible-tracker-backup.log",
      # Write rclone config from .env credentials
      "python3 -c \"import os,re; env=dict(re.findall(r'^(BACKUP_S3_\\w+)=(.+)', open('/srv/apps/bible-books-tracker/.env').read(), re.M)); os.makedirs('/root/.config/rclone', exist_ok=True); open('/root/.config/rclone/rclone.conf','w').write('[remote]\\ntype = s3\\nprovider = Cloudflare\\naccess_key_id = {a}\\nsecret_access_key = {s}\\nendpoint = {e}\\nno_check_bucket = true\\n'.format(a=env.get('BACKUP_S3_ACCESS_KEY',''),s=env.get('BACKUP_S3_SECRET_KEY',''),e=env.get('BACKUP_S3_ENDPOINT',''))); os.chmod('/root/.config/rclone/rclone.conf',0o600)\"",
      # Add daily 2 AM cron job
      "(crontab -l 2>/dev/null || true; echo '0 2 * * * /srv/apps/bible-books-tracker/scripts/backup.sh >> /var/log/bible-tracker-backup.log 2>&1') | crontab -",
    ]
  }
}
