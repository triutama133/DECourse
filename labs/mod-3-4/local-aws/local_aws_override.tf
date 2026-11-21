# Optional lesson "Apply it for real" (Module 3.4): points the AWS provider at a fake AWS on your laptop (moto).
# Copy this file into a COPY of your Terraform folder, never into labs/mod-3-4/terraform itself, so the
# offline lab tests keep working. Terraform merges any *_override.tf file into the matching block, so
# provider.tf stays as it is. Start the fake AWS first, in its own terminal:  moto_server -p 5055
provider "aws" {
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  s3_use_path_style           = true

  endpoints {
    s3  = "http://127.0.0.1:5055"
    iam = "http://127.0.0.1:5055"
    kms = "http://127.0.0.1:5055"
    sts = "http://127.0.0.1:5055"
  }
}
