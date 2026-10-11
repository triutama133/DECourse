# Lab 3.4 part A: a secure lakehouse bucket. Offline plans are checked by the tests:  pytest labs/mod-3-4/test_terraform.py -v
#
# TODO locals (provider.tf already refers to local.common_tags):
#   bucket_name = "<project>-lakehouse-<env>"
#   bucket_arn  = "arn:aws:s3:::<bucket_name>"   (build it from the NAME: then the IAM policy is known at plan time)
#   common_tags = { Project, Environment, Owner, CostCenter, ManagedBy = "terraform" }   (from the variables)
#
# TODO resources, all attached to the bucket:
#   aws_s3_bucket                                     named local.bucket_name
#   aws_s3_bucket_public_access_block                 all four block/ignore/restrict settings true
#   aws_s3_bucket_versioning                          status "Enabled" when var.enable_versioning, otherwise "Suspended"
#   aws_kms_key                                       with key rotation enabled
#   aws_s3_bucket_server_side_encryption_configuration  SSE with the KMS key (sse_algorithm "aws:kms")
#   aws_s3_bucket_lifecycle_configuration             rule 1: objects under prefix "raw/" -> storage class GLACIER_IR after var.raw_archive_days
#                                                     rule 2: abort incomplete multipart uploads after 7 days (empty filter {})
#   data aws_iam_policy_document "pipeline_s3" + aws_iam_policy "pipeline_s3" (name "<project>-<env>-pipeline-s3"), LEAST PRIVILEGE:
#       s3:GetObject and s3:PutObject only on <bucket_arn>/silver/* and <bucket_arn>/gold/*
#       s3:ListBucket on the bucket, only with condition StringLike s3:prefix in ["silver/*", "gold/*"]
#       no wildcard actions, no "*" resources, no delete, no bucket-policy permissions
