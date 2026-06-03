terraform {
  required_version = ">= 1.5"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "tls_private_key" "deploy" {
  algorithm = "ED25519"
}

# Written to infra/deploy_key — add contents to GitHub Actions secret SSH_PRIVATE_KEY
resource "local_sensitive_file" "deploy_key" {
  content         = tls_private_key.deploy.private_key_openssh
  filename        = "${path.module}/deploy_key"
  file_permission = "0600"
}
