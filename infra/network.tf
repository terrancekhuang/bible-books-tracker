# Web traffic is accepted only from Cloudflare's edge, so the proxied DNS record is the only
# way in — the origin IP leaked before the proxy went on. Fetched at plan time, so a
# `terraform apply` picks up any change to Cloudflare's published ranges.
data "cloudflare_ip_ranges" "edge" {}

resource "hcloud_firewall" "app" {
  name = "bible-books-tracker-fw"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = data.cloudflare_ip_ranges.edge.cidr_blocks
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = data.cloudflare_ip_ranges.edge.cidr_blocks
  }

  rule {
    direction  = "in"
    protocol   = "icmp"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}
