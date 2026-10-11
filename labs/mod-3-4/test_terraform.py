"""Tests for Lab 3.4 part A (Terraform).   pytest labs/mod-3-4/test_terraform.py -v

Needs the Terraform CLI on your PATH. The first run downloads the AWS provider (~650 MB); set TF_PLUGIN_CACHE_DIR to reuse it.
Nothing here talks to AWS: the provider is configured for offline planning.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

TF = shutil.which("terraform")
if not TF:
    pytest.skip("the Terraform CLI is required (https://developer.hashicorp.com/terraform/install)", allow_module_level=True)

PROJECT = labtools.lab_dir(__file__) / "terraform"
ENV = {**os.environ, "TF_IN_AUTOMATION": "1", "TF_INPUT": "0", "CHECKPOINT_DISABLE": "1"}


def tf(cwd, *args, check=True):
    res = subprocess.run([TF, *args, "-no-color"] if args[0] != "fmt" else [TF, *args], cwd=cwd, capture_output=True, text=True, env=ENV)
    if check and res.returncode != 0:
        raise AssertionError(f"terraform {' '.join(args)} failed:\n{res.stdout[-1500:]}\n{res.stderr[-1500:]}")
    return res


@pytest.fixture(scope="module")
def workdir(tmp_path_factory):
    d = tmp_path_factory.mktemp("tf") / "terraform"
    shutil.copytree(PROJECT, d, ignore=shutil.ignore_patterns(".terraform", "*.tfstate*", "tfplan*", ".terraform.lock.hcl"))
    tf(d, "init", "-backend=false")
    return d


def planned(workdir, tfvars):
    out = f"plan-{tfvars}"
    tf(workdir, "plan", f"-var-file={tfvars}.tfvars", f"-out={out}")
    data = json.loads(tf(workdir, "show", "-json", out).stdout)
    return {r["address"]: r["values"] for r in data["planned_values"]["root_module"]["resources"]}


@pytest.fixture(scope="module")
def dev(workdir):
    return planned(workdir, "dev")


@pytest.fixture(scope="module")
def prod(workdir):
    return planned(workdir, "prod")


class TestHygiene:
    def test_files_are_formatted(self, workdir):
        res = tf(workdir, "fmt", "-check", "-recursive", "-diff", check=False)
        assert res.returncode == 0, f"run `terraform fmt`:\n{res.stdout[:800]}"

    def test_configuration_is_valid(self, workdir):
        tf(workdir, "validate")

    def test_every_variable_is_described_and_typed(self):
        text = (PROJECT / "variables.tf").read_text()
        for name in ("env", "project", "owner", "cost_center", "raw_archive_days", "enable_versioning"):
            block = text.split(f'variable "{name}"')[1].split("\nvariable ")[0] if f'variable "{name}"' in text else ""
            assert "description" in block and "type" in block, f"variable {name} needs a description and a type"

    def test_an_unknown_environment_is_rejected(self, workdir):
        res = tf(workdir, "plan", "-var-file=dev.tfvars", "-var", "env=staging", check=False)
        assert res.returncode != 0 and "env must be dev or prod" in res.stdout + res.stderr


class TestSecurity:
    def test_the_bucket_is_named_after_project_and_environment(self, dev, prod):
        assert dev["aws_s3_bucket.lakehouse"]["bucket"] == "kopiku-lakehouse-dev"
        assert prod["aws_s3_bucket.lakehouse"]["bucket"] == "kopiku-lakehouse-prod"

    def test_public_access_is_blocked_completely(self, prod):
        pab = prod["aws_s3_bucket_public_access_block.lakehouse"]
        assert [pab[k] for k in ("block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets")] == [True] * 4

    def test_data_is_encrypted_with_a_rotating_kms_key(self, prod):
        enc = prod["aws_s3_bucket_server_side_encryption_configuration.lakehouse"]["rule"][0]["apply_server_side_encryption_by_default"][0]
        assert enc["sse_algorithm"] == "aws:kms"
        assert prod["aws_kms_key.lakehouse"]["enable_key_rotation"] is True

    def test_the_pipeline_policy_is_least_privilege(self, prod):
        policy = json.loads(prod["aws_iam_policy.pipeline_s3"]["policy"])
        stmts = policy["Statement"]
        as_list = lambda x: x if isinstance(x, list) else [x]  # noqa: E731
        actions = [a for s in stmts for a in as_list(s["Action"])]
        resources = [r for s in stmts for r in as_list(s["Resource"])]
        assert not any(a == "*" or a.endswith(":*") for a in actions), "no wildcard actions"
        assert not any("Delete" in a or "Policy" in a or "Acl" in a for a in actions), "no delete or policy permissions"
        assert "*" not in resources and all(r.startswith("arn:aws:s3:::kopiku-lakehouse-prod") for r in resources)
        rw = [s for s in stmts if "s3:PutObject" in as_list(s["Action"])][0]
        assert sorted(as_list(rw["Action"])) == ["s3:GetObject", "s3:PutObject"]
        assert sorted(as_list(rw["Resource"])) == ["arn:aws:s3:::kopiku-lakehouse-prod/gold/*", "arn:aws:s3:::kopiku-lakehouse-prod/silver/*"]
        listing = [s for s in stmts if "s3:ListBucket" in as_list(s["Action"])][0]
        assert listing["Resource"] == "arn:aws:s3:::kopiku-lakehouse-prod"
        assert sorted(as_list(listing["Condition"]["StringLike"]["s3:prefix"])) == ["gold/*", "silver/*"]


class TestFinOpsAndEnvironments:
    def test_every_resource_carries_the_cost_allocation_tags(self, dev):
        for addr in ("aws_s3_bucket.lakehouse", "aws_kms_key.lakehouse", "aws_iam_policy.pipeline_s3"):
            tags = dev[addr]["tags_all"]
            assert tags == {"Project": "kopiku", "Environment": "dev", "Owner": "data-platform", "CostCenter": "analytics-1001", "ManagedBy": "terraform"}, addr

    def test_raw_data_moves_to_cheaper_storage_after_the_configured_days(self, dev, prod):
        def rule(plan):
            return [r for r in plan["aws_s3_bucket_lifecycle_configuration.lakehouse"]["rule"] if r["id"] == "archive-raw"][0]
        assert rule(dev)["transition"][0]["days"] == 30 and rule(prod)["transition"][0]["days"] == 90
        assert rule(prod)["transition"][0]["storage_class"] == "GLACIER_IR"
        assert rule(prod)["filter"][0]["prefix"] == "raw/"

    def test_failed_uploads_do_not_accumulate_cost(self, prod):
        rules = {r["id"]: r for r in prod["aws_s3_bucket_lifecycle_configuration.lakehouse"]["rule"]}
        assert rules["clean-up-uploads"]["abort_incomplete_multipart_upload"][0]["days_after_initiation"] == 7

    def test_versioning_is_on_in_prod_and_off_in_dev(self, dev, prod):
        assert prod["aws_s3_bucket_versioning.lakehouse"]["versioning_configuration"][0]["status"] == "Enabled"
        assert dev["aws_s3_bucket_versioning.lakehouse"]["versioning_configuration"][0]["status"] == "Suspended"
