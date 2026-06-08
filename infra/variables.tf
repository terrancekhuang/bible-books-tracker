variable "hcloud_token" {
  description = "Hetzner Cloud API token — create one in your project under Security → API Tokens (Read & Write)"
  type        = string
  sensitive   = true
}

variable "location" {
  description = "Hetzner datacenter location: nbg1 (Nuremberg), fsn1 (Falkenstein), hel1 (Helsinki), ash (Ashburn US), hil (Hillsboro US)"
  type        = string
  default     = "ash"
}

variable "server_type" {
  description = "Hetzner server type. EU: cx22/cpx22 (x86), cax11 (ARM). US (ash/hil): cpx11 = 2 vCPU / 2 GB (x86)."
  type        = string
  default     = "cpx11"
}

variable "admin_ssh_key" {
  description = "Your personal SSH public key for admin access. Added alongside the generated deploy key."
  type        = string
  default     = ""
}
