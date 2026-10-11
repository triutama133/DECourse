# The provider is configured for OFFLINE planning: fake credentials and no calls to AWS, so that
# `terraform plan` works on a laptop with no AWS account. In a real project you would use a role, never keys in code.
provider "aws" {
  region                      = "ap-southeast-3" # Jakarta
  access_key                  = "offline"
  secret_key                  = "offline"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  default_tags {
    tags = local.common_tags # defined in main.tf
  }
}
