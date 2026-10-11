variable "env" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod."
  }
}

variable "project" {
  description = "Project name, used in resource names and tags."
  type        = string
  default     = "kopiku"
}

variable "owner" {
  description = "Team that owns these resources (for cost allocation and incident contact)."
  type        = string
}

variable "cost_center" {
  description = "Cost allocation tag."
  type        = string
}

variable "raw_archive_days" {
  description = "Days before objects under raw/ move to cheaper storage."
  type        = number
  default     = 90
}

variable "enable_versioning" {
  description = "Keep old versions of objects (recommended in prod)."
  type        = bool
  default     = false
}
