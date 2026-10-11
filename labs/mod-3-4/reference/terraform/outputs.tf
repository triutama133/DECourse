output "bucket_name" {
  value = local.bucket_name
}

output "kms_key_arn" {
  value = aws_kms_key.lakehouse.arn
}
