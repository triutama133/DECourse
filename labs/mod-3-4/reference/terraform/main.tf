locals {
  bucket_name = "${var.project}-lakehouse-${var.env}"
  # Derived from the NAME, not from the bucket resource, so the policy below is known at plan time and can be reviewed in CI.
  bucket_arn = "arn:aws:s3:::${local.bucket_name}"

  common_tags = {
    Project     = var.project
    Environment = var.env
    Owner       = var.owner
    CostCenter  = var.cost_center
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "lakehouse" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "lakehouse" {
  bucket                  = aws_s3_bucket.lakehouse.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_kms_key" "lakehouse" {
  description         = "Encrypts the ${var.env} lakehouse"
  enable_key_rotation = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.lakehouse.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id

  rule {
    id     = "archive-raw"
    status = "Enabled"

    filter {
      prefix = "raw/"
    }

    transition {
      days          = var.raw_archive_days
      storage_class = "GLACIER_IR"
    }
  }

  rule {
    id     = "clean-up-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Least privilege: the pipeline may read and write ONLY the silver/ and gold/ layers, and list only those prefixes.
data "aws_iam_policy_document" "pipeline_s3" {
  statement {
    sid     = "ReadWriteCuratedLayers"
    actions = ["s3:GetObject", "s3:PutObject"]
    resources = [
      "${local.bucket_arn}/silver/*",
      "${local.bucket_arn}/gold/*",
    ]
  }

  statement {
    sid       = "ListCuratedLayers"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["silver/*", "gold/*"]
    }
  }
}

resource "aws_iam_policy" "pipeline_s3" {
  name   = "${var.project}-${var.env}-pipeline-s3"
  policy = data.aws_iam_policy_document.pipeline_s3.json
}
