# TODO: declare the input variables (every one needs a description and a type):
#   env                 string, no default, VALIDATED to be "dev" or "prod" (use a validation block with contains(),
#                       and error_message containing "env must be dev or prod")
#   project             string, default "kopiku"
#   owner               string, no default
#   cost_center         string, no default
#   raw_archive_days    number, default 90
#   enable_versioning   bool,   default false
