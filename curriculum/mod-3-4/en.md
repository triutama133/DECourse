---
title: Infrastructure as Code (Terraform) and FinOps
duration: 3 weeks
summary: Provision a secure, encrypted, least-privilege lakehouse bucket with Terraform and review it as a plan, then write the cost models, guardrails and forecasts that stop a cloud data platform from burning money.
why: Tutorials show clicking buttons in a web console. In a company, nobody can review, repeat or roll back a click. And one accidental cross join on a large warehouse can spend a month of budget over a single weekend.
---

## @outcomes
- Explain declarative infrastructure as code, Terraform state, and the plan/apply workflow, and read a plan as a code review
- Write a Terraform configuration with variables, validation, locals, data sources, outputs and per-environment settings
- Build a secure S3 lakehouse bucket: blocked public access, KMS encryption, lifecycle rules and a least-privilege IAM policy, and test it from the plan
- Model data-platform costs (warehouse uptime and auto-suspend, scan-based pricing, storage tiers) and allocate them to teams with tags
- Put guardrails in place (timeouts, budgets, alerts, forecasts) and find a runaway query before the invoice does

## @prereq
Modules 1.1 (Linux, Docker, scripting), 2.2 (the lakehouse and object storage) and 2.4 (orchestration). Part A needs the Terraform CLI (1.5 or newer) and about 700 MB of disk for the AWS provider plugin. It needs no AWS account. Part B is plain Python.

## @lesson Why infrastructure as code
Picture the bucket where your pipeline writes its data. Someone created it in the cloud console eight months ago. Which encryption settings does it have? Who can read it? Why does the staging copy behave differently? Nobody can say for sure, because the truth lives in a web page and in somebody's memory.

**Infrastructure as code (IaC)** describes infrastructure in text files kept in Git. The consequences are the same ones you already enjoy for application code:

- **Reviewable.** A change to a permission is a pull request that a colleague reads before it happens.
- **Repeatable.** The dev and prod environments come from the same files, so they differ only where you say they differ.
- **Auditable.** `git log` answers who widened the access, when, and why.
- **Recoverable.** If a region fails or an account is compromised, you re-create the platform from code instead of from memory.
- **Testable.** As you will see in the lab, a configuration can be checked by a program before anything is created.

IaC tools come in two styles. An **imperative** script says *how*: "create a bucket, then set encryption". A **declarative** configuration says *what*: "a bucket with these properties exists". The tool compares what you declared with what exists and works out the steps. Terraform (and its open-source fork OpenTofu), CloudFormation and Pulumi are declarative. Declarative tools are safe to run twice: the second run finds nothing to do. That property, *idempotence*, is the same one you demanded of pipelines in Module 0.1.

"Click-ops" is not forbidden because clicking is hard. It is forbidden because a console change is invisible to review, impossible to repeat exactly, and the first thing to go wrong during an incident.

## @lesson Terraform in practice
A Terraform project is a folder of `.tf` files written in HCL, a small configuration language. The pieces you will use constantly:

```hcl
variable "env" {                       # an input
  type        = string
  description = "Deployment environment."
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod."
  }
}

locals {                               # a computed value, reused below
  bucket_name = "${var.project}-lakehouse-${var.env}"
}

resource "aws_s3_bucket" "lakehouse" { # something Terraform creates and manages
  bucket = local.bucket_name
}

output "bucket_name" {                 # something other code can read
  value = local.bucket_name
}
```

- A **provider** is a plugin that knows one platform's API (`aws`, `google`, `snowflake`, `kubernetes`). It is downloaded by `terraform init`. The AWS provider is large (about 650 MB in the lab), which is why teams share a plugin cache.
- A **resource** is an object Terraform creates, updates and destroys. A **data source** (`data "..."`) only reads or computes something. In the lab, the IAM policy document is a data source: it computes a JSON policy and creates nothing.
- **Variables** make the same code serve several environments. Values come from `-var-file=prod.tfvars`, the command line, or the environment. A `validation` block rejects nonsense at the earliest possible moment (the lab's test proves that `env=staging` is refused).
- **References** such as `aws_s3_bucket.lakehouse.id` create a dependency graph. Terraform builds the bucket before the public-access block that refers to it, and runs independent resources in parallel.

### The workflow and the state file

```bash
terraform init      # download providers, set up the state backend
terraform fmt       # canonical formatting; CI runs it with -check
terraform validate  # syntax and type checks, no API calls
terraform plan      # compare code, state and reality; print what would change
terraform apply     # make it so (asks for confirmation unless given a saved plan)
```

Terraform keeps a **state file** that maps every resource in your code to the real object it created (`aws_s3_bucket.lakehouse` is bucket `kopiku-lakehouse-prod`). Without state, Terraform could not tell "create this" from "this already exists". State is therefore precious and sensitive: it can contain secrets in plain text. Never commit it. In a team you store it in a **remote backend** (for example an S3 bucket with versioning and encryption, or Terraform Cloud) that supports **locking**, so that two people cannot apply at the same time and corrupt it. Older S3 setups lock through a DynamoDB table; recent Terraform versions can lock with a file in the bucket itself.

The `plan` is the heart of the tool. It prints `+` for create, `~` for update in place and `-/+` for **destroy and re-create**. Learn to hunt for the last one: changing the name of a bucket or database does not rename it, it replaces it, and a replaced database is a deleted database. `lifecycle { prevent_destroy = true }` makes Terraform refuse to delete a resource you cannot afford to lose.

Reality can change behind Terraform's back (a colleague edits something in the console). This is **drift**. `plan` shows it as a difference to undo, which is one more reason to remove console write access from most people.

### Environments and modules

Dev and prod usually share the same code with different variable files; in the lab `dev.tfvars` archives raw data after 30 days and prod after 90, and only prod keeps object versions. For larger systems you extract repeated blocks into **modules** (a folder with inputs and outputs, called like a function), and give each environment its own state, ideally its own cloud account. The blast radius of a mistake in dev must not include prod.

> 💡 **Practice Pause 1 (Terraform Variable Declaration & Environment Validation):**
> 1. Open `labs/mod-3-4/terraform/variables.tf` in your text editor. Do not execute Terraform files directly without the CLI.
> 2. Declare the input variables: `env` (with a validation rule accepting only dev or prod), `project`, `owner`, `cost_center`, `raw_archive_days`, and `enable_versioning`, each with its type and description.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_terraform.py -k TestHygiene -v`
> 4. **Success Indicator:** All tests in `TestHygiene` report `PASSED` (or cleanly skip if the Terraform CLI is not installed), verifying HCL formatting, valid syntax, and rejection of invalid environment names.

## @lesson Securing the lakehouse
The lab builds the storage layer of the lakehouse from Module 2.2, with four protections that every company that holds customer data expects.

**1. Block public access.** Breaches like "customer files found in an open bucket" are mostly configuration mistakes. `aws_s3_bucket_public_access_block` with all four flags `true` makes it impossible for a later policy or ACL to expose the bucket, whatever someone writes in a hurry.

**2. Encrypt, with a key you control.** S3 encrypts objects by default, but with a key AWS manages. A **KMS key** you own adds an access layer (the reader needs permission on the key as well as on the data), an audit trail of every use, and the ability to revoke access centrally. Turn on **key rotation** so that a leaked old key is limited in time.

**3. Least privilege.** An IAM policy lists who may do which *actions* on which *resources*, optionally under *conditions*. The mistake you will see in every real code base is `"Action": "s3:*", "Resource": "*"`, written once "to make it work" and never removed. A pipeline that only needs to read and write the curated layers should receive exactly that:

| Statement | Actions | Resource |
|---|---|---|
| Read/write curated data | `s3:GetObject`, `s3:PutObject` | `bucket/silver/*`, `bucket/gold/*` |
| List the bucket | `s3:ListBucket` | the bucket, only when `s3:prefix` matches `silver/*` or `gold/*` |

The pipeline cannot delete, cannot touch `raw/` or other teams' prefixes, and cannot rewrite the bucket policy. If its credentials leak, the damage is bounded by what you wrote here. Writing the policy is only half the work: test it. The lab asserts "no wildcard actions, no delete, no `*` resource" against the planned JSON.

**4. Lifecycle rules.** Raw data is written once and read rarely. A lifecycle rule moves objects under `raw/` to a cheaper storage class after a number of days, and a second rule aborts **incomplete multipart uploads** after 7 days. (A failed large upload leaves invisible parts that you pay for until someone removes them. This is a classic silent cost.)

### Testing infrastructure before it exists

How do you test code that creates cloud resources, without creating them? In layers, cheapest first:

1. `fmt -check` and `validate`: seconds, no cloud.
2. **Static policy scanners** (tfsec/Trivy, Checkov, OPA/Conftest) that flag public buckets, missing encryption and wildcard IAM.
3. **Plan-based tests**: run `terraform plan -out=plan` then `terraform show -json plan` and assert on the JSON. This is what the lab does, and it works offline because the provider is configured with fake credentials and skip flags.
4. Apply in a throwaway sandbox account, check with the real API, destroy. Slower and costs money, so reserve it for modules you share widely.

One subtle point from the lab. The IAM policy mentions the bucket's ARN. If you write `aws_s3_bucket.lakehouse.arn`, that value is *known only after apply*, so the planned policy JSON is not visible and the reviewer sees "(known after apply)" instead of the permissions. Building the ARN from the bucket **name** (`arn:aws:s3:::${local.bucket_name}`) makes the entire policy readable at plan time. Design your configuration so that the security-relevant facts are visible in the plan.

**Tags** belong here too. With `default_tags` on the provider, every resource gets `Project`, `Environment`, `Owner` and `CostCenter` automatically, and the lab checks it. Tags are how the invoice becomes understandable in the next lesson.

> 💡 **Practice Pause 2 (Lakehouse S3 Security & Least-Privilege IAM Policy):**
> 1. Open `labs/mod-3-4/terraform/main.tf` and `labs/mod-3-4/terraform/outputs.tf` in your text editor.
> 2. Complete the S3 bucket resource, block public access (`aws_s3_bucket_public_access_block` with all four flags set to `true`), customer-managed KMS key with rotation enabled, default SSE encryption, raw storage lifecycle rules, and least-privilege IAM policy restricting actions to silver and gold prefixes.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_terraform.py -v`
> 4. **Success Indicator:** All 12 tests in `test_terraform.py` report `PASSED` (or cleanly skip if CLI is not installed), proving that the offline dev and prod plans satisfy enterprise security standards.

## @lesson Where cloud data platforms spend your money
Cloud pricing has three shapes. Learn which one each service uses and most surprises disappear.

**1. You pay while it is running** (warehouses and clusters). Snowflake-style warehouses, Databricks clusters, EMR and Redshift bill for uptime, not for work done. A warehouse that is awake but idle is billed exactly like one that is busy. Two settings decide the bill:

- **Auto-suspend**: how many idle seconds before the warehouse sleeps. After a query finishes, you pay for the whole suspend window.
- **Minimum billing**: many warehouses bill at least 60 seconds each time they resume, so a stream of tiny queries that keep waking it is expensive.

**2. You pay for what you scan** (serverless engines such as BigQuery on-demand and Athena): a price per terabyte read, a few dollars per TB (check current prices). Here the lever is data layout: partitioning, clustering, columnar formats and selecting only the columns you need (Modules 2.1 and 2.2). The same query on badly laid-out data costs ten times more.

**3. You pay for storage and for moving data** (object storage, snapshots, cross-region and internet egress). Storage is cheap per gigabyte but never stops. Colder tiers cost less per GB but charge for retrieval and often have minimum storage durations, so archiving data that is read often can cost *more*, and the lab tests exactly that.

### What the lab measured

The lab's query log has 2,083 queries across 30 days: about 33 hours of real query work for three teams (marketing, finance, data-engineering). It is deterministic, so you reproduce it exactly. One simulated warehouse (1 credit per hour at an assumed $3 per credit) serves them all, and only auto-suspend changes:

| Auto-suspend | Hours billed | Cost |
|---|---|---|
| 0 s (the 60 s minimum still applies) | 52.6 | $158 |
| 60 s | 62.5 | $188 |
| 5 min | 148.9 | $447 |
| 10 min | 209.2 | $628 |
| 30 min | 287.2 | $861 |
| 1 hour | 331.8 | $995 |

Real work: 33 hours. A setting nobody looked at made the bill range from $158 to $995 for identical work, because queries arrive in bursts and every gap shorter than the window keeps the machine awake. The trade-off is real: a very short suspend costs you the warehouse's local cache and a few seconds of resume time, so interactive dashboards often choose 60 to 300 seconds, while a batch job's warehouse should suspend immediately. The right number comes from measuring your own query log, which is what `billed_seconds` does.

### Allocation: who spent it?

An invoice that says "compute: $4,200" starts an argument. A report that says "marketing $1,900, finance $600, data-engineering $1,700, unowned $0" starts a decision. This needs a **tag on every resource and query** (the Terraform tags above; query tags or a service account per team on the warehouse). Make the tags mandatory in code review, and treat untagged spend as a bug: unowned spend is the spend nobody ever reduces.

Learn the vocabulary of the field, known as **FinOps**: *showback* (show each team what it spent), *chargeback* (bill it internally), *unit economics* (dollars per thousand orders processed, or per dashboard user), and *commitments* (reserved capacity at a discount in exchange for a promise of usage, which only pay off for a steady base load).

> 💡 **Practice Pause 3 (FinOps Warehouse Cost Modeling & Tag Allocation):**
> 1. Open `labs/mod-3-4/finops.py` in your text editor.
> 2. Implement `query_cost(seconds, credits_per_hour, price_per_credit)` for warehouse compute costs, `billed_seconds(queries, auto_suspend_s, minimum_s)` modeling idle tails and 60-second minimums, and `cost_by_tag(log)` allocating total spend per team.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestQueryCost or TestBilledSeconds or TestCostByTag" -v`
> 4. **Success Indicator:** All 14 tests report `PASSED` in milliseconds in pure Python, validating warehouse uptime billing and team cost allocation.

## @lesson Guardrails, budgets and forecasts
You cannot rely on people to be careful at 22:30 on a Friday. Controls must be automatic.

**Prevent.**
- **Statement timeouts** on every warehouse and every service account (a one-hour limit kills a cross join long before the weekend ends).
- **Resource monitors / budgets** that suspend compute or page someone at a spending threshold (50%, 80%, 100% of the month).
- **Scan limits**: a maximum bytes billed per query on scan-priced engines, so that a missing partition filter fails instead of billing.
- **Separate warehouses** for dashboards, ad-hoc analysis and batch pipelines, so a runaway analyst cannot starve (or inflate the schedule of) production, and the bill separates itself.
- **Right-sizing**: a warehouse twice the size often finishes in half the time for roughly the same cost, but one 4x too large for a small query just burns credits. Measure, do not guess.

**Detect.** A budget alert at month end is an autopsy. You want daily signals:
- **Forecast the month.** The lab's `forecast_month` takes the spend so far, projects the last seven days of average cost over the remaining days, and reports the day on which the budget will be breached. A single spike inside those seven days is projected forward too, so the forecast can be pessimistic for a week; production versions exclude flagged one-off queries or use a median. A job that is 40% over its normal day on day 6 produces a warning on day 6, not an invoice on day 31.
- **Find outliers with the median, not the mean.** `find_runaway` flags a query whose duration is more than 10 times the median of its own team. The test case is five queries of 10, 10, 10, 10 and 1,000 seconds: the mean is 208 seconds, so a mean-based rule would call the 1,000-second query normal, while the median (10) catches it. The outlier corrupts the very average you use to detect it.
- **Judge each group against its own normal**: 900 seconds is routine for a nightly data-engineering job and absurd for a dashboard.

**Waste you should hunt for regularly:** warehouses with long suspend windows, idle clusters left over from experiments, dev environments running nights and weekends (schedule them to stop), incomplete multipart uploads, old snapshots and orphaned volumes, duplicate full copies of tables, "SELECT *" over wide tables, and dashboards that refresh every minute although the data changes daily.

### Doing IaC and FinOps together in a team

- Run `fmt -check`, `validate`, a policy scan and `plan` on every pull request, and post the plan as a comment; run `apply` automatically only after merge, from CI, never from a laptop. The pipeline holds the credentials, so no human needs long-lived admin keys.
- Keep secrets out of `.tf` files, `tfvars` and state (use a secret manager and pass references).
- Give CI a role that can create the resources but not change IAM beyond the project boundary, and review any permission change with extra care.
- Add cost estimates to the plan review (tools like Infracost do this) so that "this adds a 16-credit warehouse" is visible before it is merged.
- Start every new environment with a **teardown** in mind: `terraform destroy` for dev environments should be a normal, boring command.

> 💡 **Practice Pause 4 (FinOps Guardrails: Runaway Detection, Forecasting & Storage Tiering):**
> 1. Open `labs/mod-3-4/finops.py` in your text editor.
> 2. Implement `find_runaway(log, factor)` using team median duration to flag extreme outliers, `forecast_month(daily_costs, days_in_month, budget)` projecting the day a monthly budget breaches, and `storage_cost(objects, archive_after_days)` modeling cold archive storage vs retrieval economics.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestFindRunaway or TestForecast or TestStorageCost" -v`
> 4. **Success Indicator:** All 15 tests report `PASSED` in milliseconds in pure Python, proving query outlier detection, monthly budget forecasting, and storage tiering trade-offs work accurately.

## @lab Lab: a secure lakehouse bucket and a cost guardrail toolkit
Part A: finish a Terraform configuration until an offline plan proves the bucket is private, encrypted, lifecycle-managed, tagged and accessible only through a least-privilege policy. Part B: write the Python functions behind your FinOps controls: warehouse billing, cost by team, runaway detection, a budget forecast and storage tiering.

### @steps
1. Install pytest and the Terraform CLI (1.5 or newer, from developer.hashicorp.com/terraform/install, or OpenTofu). Reuse the heavy provider download across runs:

```bash
python -m pip install -r labs/mod-3-4/requirements.txt
export TF_PLUGIN_CACHE_DIR=$HOME/.terraform.d/plugin-cache && mkdir -p "$TF_PLUGIN_CACHE_DIR"
pytest labs/mod-3-4 -v          # the starter fails at first
```

2. **Part A.** In `labs/mod-3-4/terraform/`, `versions.tf`, `provider.tf` and the two `.tfvars` files are provided (read `provider.tf`: why does `plan` work with no AWS account?). Declare the variables in `variables.tf`, then follow the TODO list in `main.tf` and `outputs.tf`.
3. Work with the real CLI while you write: `cd labs/mod-3-4/terraform && terraform init -backend=false && terraform validate && terraform plan -var-file=dev.tfvars`. Read the plan as a reviewer would. Run `terraform fmt` before testing, since formatting is one of the tests.
4. Run `pytest labs/mod-3-4/test_terraform.py -v` (about 30 seconds after the first provider download). The tests inspect `terraform show -json` of the dev and prod plans.
5. Read the failing test for the IAM policy carefully. It asserts the exact actions, resources and the `s3:prefix` condition. Replace `local.bucket_arn` with `aws_s3_bucket.lakehouse.arn` and look at the plan: the policy turns into "known after apply".
6. **Part B.** Open `labs/mod-3-4/finops.py` and implement the five functions. The query log comes from `labs/shared/querylog.py`: print the first rows and the largest query before you start. Run `pytest labs/mod-3-4/test_finops.py -v`.
7. Use your functions to answer: what auto-suspend would you choose for the shared warehouse and why? Which team paid for the 11-hour query? Add up each day's cost and try `forecast_month` with a $75 budget: what does it say on day 15, and on day 16 (the day the runaway starts)? Why is the day-16 forecast too pessimistic, and how could `find_runaway` improve it?

> 💡 **Practice Pause 5 (Full Verification & Proof Token):**
> 1. In terminal, run the complete FinOps test suite:
>    `pytest labs/mod-3-4/test_finops.py -v`
> 2. Generate the verification proof token:
>    `python3 scripts/prove.py mod-3-4`
> 3. **Success Indicator:** All tests report `PASSED` and your completion proof token is printed to terminal.

### @files
- labs/mod-3-4/terraform/variables.tf :: Part A: declare the input variables :: starter
- labs/mod-3-4/terraform/main.tf :: Part A: the lakehouse resources (follow the TODO list) :: starter
- labs/mod-3-4/terraform/outputs.tf :: Part A: outputs :: starter
- labs/mod-3-4/terraform/provider.tf :: Provider with offline settings and default tags (provided) :: config
- labs/mod-3-4/terraform/versions.tf :: Required Terraform and provider versions (provided) :: config
- labs/mod-3-4/terraform/dev.tfvars :: Dev values (provided) :: config
- labs/mod-3-4/terraform/prod.tfvars :: Prod values (provided) :: config
- labs/mod-3-4/test_terraform.py :: Part A tests (12, from the planned JSON) :: test
- labs/mod-3-4/finops.py :: Part B working file: five cost functions :: starter
- labs/mod-3-4/test_finops.py :: Part B tests (29) :: test
- labs/shared/querylog.py :: Deterministic 30-day query log with a planted runaway :: data
- labs/mod-3-4/requirements.txt :: pytest and installation notes :: config
- labs/mod-3-4/reference/terraform/main.tf :: Part A reference (try first!) :: reference
- labs/mod-3-4/reference/terraform/variables.tf :: Part A reference variables :: reference
- labs/mod-3-4/reference/terraform/outputs.tf :: Part A reference outputs :: reference
- labs/mod-3-4/reference/finops.py :: Part B reference :: reference

### @deliverables
- Part A: all 12 tests pass for both `dev` and `prod` plans, and `terraform fmt -check` is clean
- Part B: all 29 tests pass
- A short note (5 lines) with your auto-suspend recommendation, the owner of the runaway cost, and how your forecast reacts to the runaway day

### @verify
```bash
pytest labs/mod-3-4/test_terraform.py -v
pytest labs/mod-3-4/test_finops.py -v
```

Known-good run: prefix with `LAB_DIR=reference`. The Terraform tests are skipped, with a message, if the CLI is not installed.

## @chaos The eleven-hour query
### @scenario
It is Friday, 22:30. An analyst in marketing starts an exploratory query to find customers who bought two products together. In the rush to get home they join the orders table to itself without a join condition. The shared warehouse is large, has no statement timeout, and its auto-suspend is set to one hour. The query does not fail. It runs all night, all Saturday and into Saturday evening, for 11 hours, scanning 40 TB.

Nobody notices: the dashboards still load, because the warehouse is large enough to run them next to the monster. On Monday the finance team sees the weekly invoice, and asks why the data platform cost more over one weekend than in the previous two weeks combined. In the lab's scale model the query costs $33 on a 1-credit warehouse. On a 16-credit warehouse, the same 11 hours cost $528, and on a scan-priced engine, 40 TB at a few dollars per TB is hundreds of dollars more.

### @cause
There was no *automatic* limit anywhere between a typo and the invoice. Specifically: no statement timeout, so a query could run forever; one shared warehouse for dashboards, analysts and pipelines, so a single query did not stand out; no daily spend forecast or alert, so a weekend of 5x normal spend produced no signal; and no budget threshold that could page anyone. Cost data was only looked at once a month, by someone who cannot tell which query is which.

A second factor was that the cost could not be traced quickly. Without team tags and query tags, finding out who ran it took two days of digging through logs, and by then the discussion was about blame rather than about the missing controls.

### @fix
1. Kill the query at once, and check from the vendor's usage views how much it really cost.
2. Set **statement timeouts** per warehouse and role (for example 1 hour for analysts, longer for the batch warehouse), and a **maximum bytes billed** on scan-priced engines.
3. Split warehouses by workload (BI, ad-hoc, pipelines), each with its own budget and a **resource monitor** that alerts at 50% and 80% and suspends at 100%.
4. Make `find_runaway` and `forecast_month`-style checks run daily from the query log and send alerts; the forecast should have flagged the abnormal weekend by Saturday morning.
5. Require team and query tags (enforced in Terraform and in the warehouse roles), and review the top ten most expensive queries every week.
6. Put these settings in Terraform so they cannot be changed by a click and so that new warehouses start with safe defaults.

### @pattern
Cost is a production metric. Put automatic limits in code, forecast spend daily, and make every dollar traceable to an owner before the incident, not after it.

## @quiz
### What does the Terraform state file do, and why is it handled carefully?
- [ ] It records the Git history of the configuration, so it should be committed as well
- [x] It maps resources in code to real objects and can hold secrets, so teams use a locked remote backend
- [ ] It caches the provider plugin so that plans run faster, which is why it is safe to share publicly
- [ ] It stores the cloud account password so that Terraform can sign in, and nothing else is ever kept in it

> Without state Terraform cannot tell create from update. It contains attribute values, sometimes secrets, so it is kept out of Git, encrypted, and locked so two applies cannot run at once.

### In `terraform plan` you see `-/+` next to a production database after a small edit. What does it mean, and what do you do?
- [ ] The database will be updated in place with no downtime, so the plan can be approved as it is
- [ ] Terraform found a drift in tags only, which is shown with this symbol and is harmless to data
- [x] It will be destroyed and then re-created, so stop and find which change forces the replacement
- [ ] The database will be created a second time next to the first one, so that traffic can switch over

> `-/+` is replacement. Renaming or changing an immutable attribute replaces the resource, which for a database means deleting the data. Review such lines first, and protect important resources with `prevent_destroy`.

### Why does the lab build the bucket ARN from the bucket name instead of using the bucket resource's `arn` attribute?
- [ ] Names are guaranteed to be unique across all AWS accounts, but ARNs are not and so could clash
- [ ] Terraform does not allow a data source to refer to any attribute of a resource in the same configuration
- [x] A value built from the name is known at plan time, so the whole policy is visible in the plan output
- [ ] The `arn` attribute of the bucket exists only in older provider releases that are no longer supported

> An attribute assigned by the cloud is "known after apply", which hides the policy from reviewers and from plan-based tests. Deriving it from inputs makes the security-relevant facts reviewable.

### A pipeline only needs to read and write the `silver/` and `gold/` layers. Which IAM policy follows least privilege?
- [ ] `s3:*` on the single bucket only, because it is limited to this one project and its data
- [ ] `s3:GetObject` and `s3:PutObject` on every bucket, so the pipeline can be reused for other projects later
- [x] `s3:GetObject` and `s3:PutObject` on `silver/*` and `gold/*`, with listing limited to those prefixes
- [ ] Administrator access that is switched off by a condition in the policy outside of working hours

> Grant only the actions the job needs on only the resources it touches. A leaked credential then cannot delete data, read `raw/`, or change the bucket policy.

### On a warehouse billed per second while running, the auto-suspend setting goes from 60 seconds to 1 hour with the same queries. What happens to the bill?
- [ ] It stays the same, because billing counts only the seconds in which queries actually executed
- [ ] It falls, because a warehouse that stays awake keeps its cache and so finishes each query faster
- [x] It rises a lot, because each gap shorter than the window keeps the warehouse awake and billed
- [ ] It changes only for the very first query of the day, because the warehouse is started once only

> You pay for uptime, including the idle tail. In the lab the same 33 hours of queries cost $188 at 60 seconds and $995 at one hour.

### Why does the lab use the median of a team's query durations, rather than the mean, to find runaway queries?
- [ ] The median is faster to compute on large logs, while the mean needs a full pass over all rows
- [ ] The mean cannot be calculated for times, which means that only the median is defined for durations
- [x] A huge outlier inflates the mean and can hide itself, while the median stays at the normal level
- [ ] The median shows the longest query in a group directly, so it needs no further comparison step

> One query of 1,000 seconds among four of 10 seconds lifts the mean to 208, so a 10-times-the-mean rule misses it. The median stays at 10 and the outlier is flagged.

### Why can moving frequently read data to a colder storage tier cost more than leaving it where it is?
- [ ] Cold tiers always encrypt data a second time, which doubles the price of every stored gigabyte
- [ ] Lifecycle rules are billed per rule and per object, so every rule costs more than the storage it saves you
- [x] Cold tiers charge per GB retrieved and have minimum durations, so heavy reads can outweigh the saving
- [ ] Cold storage is not allowed to be read at all, so the data must first be copied back into place

> Colder classes lower the per-GB storage price but add retrieval fees and minimum storage periods. Archive data that is rarely read, and measure access before choosing the rule.

### Which control would have stopped the eleven-hour query automatically, at the lowest cost?
- [ ] A weekly meeting where the team reviews the invoice, so that unusual weekends are talked about
- [ ] A rule that analysts must tell the data team before running any query that might be large
- [x] A statement timeout on the warehouse, with a budget alert so that unusual spend pages someone
- [ ] A bigger warehouse for the whole company, so a single query takes proportionally less time

> People are unreliable at 22:30 on a Friday. A timeout kills the query by itself, and a budget alert or daily forecast tells someone before the month closes. Process and meetings detect problems late.

## @resources
- [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- [Terraform AWS provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [OpenTofu](https://opentofu.org/docs/)
- [AWS IAM: security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Amazon S3 storage classes](https://aws.amazon.com/s3/storage-classes/)
- [FinOps Foundation: framework and principles](https://www.finops.org/framework/)
- [Checkov: policy-as-code scanner for Terraform](https://www.checkov.io/)
- [Infracost: cloud cost estimates in pull requests](https://www.infracost.io/docs/)
