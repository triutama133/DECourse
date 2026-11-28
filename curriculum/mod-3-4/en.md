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

## @part Infrastructure as code and security

## @lesson Why infrastructure as code
Picture the bucket where your pipeline writes its data. Someone created it in the cloud console eight months ago. Which encryption settings does it have? Who can read it? Why does the staging copy behave differently? Nobody can say for sure, because the truth lives in a web page and in somebody's memory.

:::talk Apply it twice
@teacher You describe a storage bucket in Terraform code and run `terraform apply`. It creates the bucket. Then, without changing anything, you run `terraform apply` again.
@ask What happens the second time?
@choice It creates a second bucket with the same name | A bucket name is unique, and more importantly Terraform compares what you described with what exists. Try again.
@choice It fails, because the bucket already exists | It does not fail: it sees the bucket is already as described. Try again.
@choice * Nothing: it compares the code with reality, finds no difference, and changes nothing | Yes. You describe the end state, and the tool works out the steps. Running it twice is safe, which is the property of idempotency from Module 2.4, now applied to infrastructure.
@teacher That is also why `terraform plan` is useful: it shows the difference before anything changes, and the line to read twice is every `destroy`.
:::

**Infrastructure as code (IaC)** describes infrastructure in text files kept in Git. The consequences are the same ones you already enjoy for application code:

- **Reviewable.** A change to a permission is a pull request that a colleague reads before it happens.
- **Repeatable.** The dev and prod environments come from the same files, so they differ only where you say they differ.
- **Auditable.** `git log` answers who widened the access, when, and why.
- **Recoverable.** If a region fails or an account is compromised, you re-create the platform from code instead of from memory.
- **Testable.** As you will see in the lab, a configuration can be checked by a program before anything is created.

IaC tools come in two styles. An **imperative** script says *how*: "create a bucket, then set encryption". A **declarative** configuration says *what*: "a bucket with these properties exists". The tool compares what you declared with what exists and works out the steps. Terraform (and its open-source fork OpenTofu), CloudFormation and Pulumi are declarative. Declarative tools are safe to run twice: the second run finds nothing to do. That property, *idempotence*, is the same one you demanded of pipelines in Module 0.2.

"Click-ops" is not forbidden because clicking is hard. It is forbidden because a console change is invisible to review, impossible to repeat exactly, and the first thing to go wrong during an incident.

> 🛠 **Try it (15 min, Python).** Model a declarative tool. `desired` is a dict of resources: `raw-bucket` (`encryption: True, versioning: True`), `curated-bucket` (`encryption: True, versioning: False`) and `etl-role` (`policy: "read-raw"`). `actual` has `raw-bucket` (`encryption: False, versioning: True`), `old-bucket` (`encryption: True`) and `etl-role` (`policy: "read-raw"`). Write `plan(desired, actual)` returning a list of `("create" | "update" | "destroy", name)` and `apply(...)` that makes `actual` match. Print the plan, apply it, and print the plan again.
>
> **You should see:** `[('create', 'curated-bucket'), ('update', 'raw-bucket'), ('destroy', 'old-bucket')]` and then `[]`. The second run finds nothing to do: that is what "safe to run twice" means, and it is the heart of `terraform plan` and `apply`. The `destroy` line is the one a careful reviewer reads twice.

:::ask Why is a change to infrastructure written as code and reviewed in a pull request safer than a click in the console?
@options
* peer review and full Git change history
the console is always much slower than code
code can never contain any mistakes at all
@why
Reviewable, repeatable and auditable are the three gains. The same files build dev and prod, and the history shows who changed which permission and when.
:::

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
- A **resource** is an object Terraform creates, updates and destroys. A **data source** (`data "..."`) only reads or computes something. In the lab, the **IAM** (Identity and Access Management) policy document is a data source: it computes a JSON permissions policy and creates nothing.
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
> 2. Declare the input variables: `env` (with a `validation` rule accepting only `"dev"` or `"prod"` and an `error_message` containing `"env must be dev or prod"`), `project`, `owner`, `cost_center`, `raw_archive_days`, and `enable_versioning`, each with its `type` and `description`.
> 3. Because `provider.tf` already references `local.common_tags`, also open `labs/mod-3-4/terraform/main.tf` and add the `locals { common_tags = { ... } }` block (mapping `Project`, `Environment`, `Owner`, `CostCenter`, and `ManagedBy = "terraform"`), leaving the AWS resources for Practice Pause 2. Run `terraform fmt` in `labs/mod-3-4/terraform/`.
> 4. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_terraform.py -k TestHygiene -v`
> 5. **Success Indicator:** All tests in `TestHygiene` report `PASSED` (or cleanly skip if the Terraform CLI is not installed), verifying HCL formatting, valid syntax, and rejection of invalid environment names.

:::ask What does the Terraform state file hold?
@options
a backup copy of all data in your storage buckets
* a map linking your code to real cloud objects
the login passwords of your cloud users
@why
Without state, Terraform could not tell 'create this' from 'this already exists'. It compares your code, the state and reality to build the plan. Keep it in a shared, locked, access-controlled place.
:::

## @lesson Cloud networking in plain words: addresses, doors and walls
> **In short:** A cloud network is like an apartment building. Every machine has an address (IP) and numbered doors (ports). The building has floors (subnets), a front door to the street, rules about who may knock (firewall rules) and a bill for the traffic that leaves. If you can read those five ideas, the rest of this module, and every cloud diagram you will ever see, stops looking like noise.

Your pipelines run on machines in the cloud. They read from a database, write to a bucket, call an API. **Networking** decides who can reach what, and what that traffic costs. Do not memorise terms: keep the building in your head.

| In the building | In the cloud | What it is |
|---|---|---|
| the whole building | **VPC** (Virtual Private Cloud) | your private network inside a cloud region |
| a street address | **IP address** | the number that names one machine |
| the numbered doors of one flat | **port** | which program on that machine you are knocking for |
| a floor | **subnet** | a slice of the building's addresses, public or private |
| the front door to the street | **internet gateway** | the way in and out for public subnets |
| a service door for deliveries out | **NAT gateway** | lets private machines start requests to the internet, while nothing outside can start one to them |
| the guard's list at a door | **security group** | rules saying who may knock on which door |

### Addresses: IP and CIDR in two minutes

:::talk How many addresses in a /20?
@teacher Your cloud network is `10.0.0.0/16`. You want to cut it into smaller subnets of the size `/20`. An IP address has 32 bits, and the number after the slash says how many of them are fixed. The rest are free to count with.
@ask How many addresses does one `/20` subnet hold?
@choice 20, because of the number after the slash | The number after the slash counts the FIXED bits, not the addresses. Try again.
@choice * 4,096: 32 - 20 = 12 free bits, and 2 to the power 12 is 4,096 | Yes. And AWS keeps 5 addresses of every subnet for itself, so 4,091 are usable. A `/16` holds 16 such subnets.
@choice 65,536, the size of the whole `/16` | That is the whole network. A `/20` is a slice of it: 16 slices fit in a `/16`. Try again.
@teacher Smaller number after the slash means a bigger network. Size subnets with room to grow, because changing a subnet's range later forces replacement.
:::

Every computer on a network has an **IP address**: four numbers from 0 to 255 separated by dots, like `10.0.37.5`. It works like a street address. A **CIDR block** names a whole *range* of addresses at once, for example `10.0.0.0/16`.

The number after the slash says how many of the address's 32 bits are **locked** (each of the four numbers is 8 bits). `/16` locks the first two numbers (`10.0.`), so every address from `10.0.0.0` to `10.0.255.255` belongs to the block. The more bits are locked, the smaller the block: `/24` locks three numbers and holds 256 addresses, `/16` holds 65,536. The rule is **block size = 2 ** (32 − the number after the slash)**. A VPC is one big block that you cut into smaller **subnets**.

:::drill python How big is the block?
Write `block_size(prefix)`: the number of addresses in a CIDR block whose number after the slash is `prefix`. `block_size(24)` is `256`.
@starter
# write your function below this line

@check
defines("block_size") ## Define block_size(prefix).
block_size(24) == 256 ## A /24 locks 24 bits: 2 ** 8 = 256 addresses.
block_size(16) == 65536 ## A /16: 2 ** 16.
block_size(32) == 1 ## All 32 bits locked: exactly one address.
block_size(20) == 4096 ## A /20: 2 ** 12.
@hint
An IPv4 address has 32 bits total; subtract the locked prefix bits to get the host bits, then raise 2 to that power.
@solution
def block_size(prefix):
    return 2 ** (32 - prefix)
:::

:::drill python Is this address inside the block?
Write `in_block(ip, cidr)`: `True` if the address is inside the CIDR block. The standard library helps: `ipaddress.ip_address(...)` and `ipaddress.ip_network(...)` understand both texts, and `in` checks membership.
@starter
import ipaddress
# write your function below this line

@check
defines("in_block") ## Define in_block(ip, cidr).
in_block("10.0.37.5", "10.0.32.0/20") == True ## 10.0.32.0/20 covers 10.0.32.0 to 10.0.47.255.
in_block("10.0.48.1", "10.0.32.0/20") == False ## 48 is past the end of that /20.
in_block("10.0.1.1", "10.0.0.0/16") == True ## Inside the big block.
in_block("192.168.0.1", "10.0.0.0/16") == False ## A different network.
@hint
Parse the IP string into an address object and the CIDR string into a network object using the `ipaddress` module, then test membership with `in`.
@solution
import ipaddress
def in_block(ip, cidr):
    return ipaddress.ip_address(ip) in ipaddress.ip_network(cidr)
:::

### Ports: the numbered doors

An IP address finds the machine. A **port** (a number from 0 to 65535) finds the *program* on it. A web server listens at port 80 or 443, PostgreSQL at 5432, Kafka at 9092, and the course site on your own computer at 3000. You write both together: `10.0.1.5:5432`. **localhost** (the address `127.0.0.1`) always means "this same computer".

Two programs cannot listen at the same door. If you start a database and see "port already in use", something else is already listening there: stop it or pick another port.

### Public and private subnets, and the NAT gateway

A **public subnet** has a route to the internet gateway, so machines in it can be reached from the internet if a firewall rule allows it. A **private subnet** has no such route: nothing on the internet can even try to reach it. Databases, warehouse compute and pipeline workers belong in private subnets.

But a private job still needs to download a library or call an API. A **NAT gateway** (network address translation) solves that: the private machine starts the request, the NAT gateway sends it out and brings the answer back, and nothing outside can start a conversation with the private machine. It is convenient, and it is **billed by the hour and by the gigabyte** that passes through it (Lesson 7 of this module shows how large that bill can get). For S3 traffic there is a cheaper way, the gateway endpoint, which keeps the data on the cloud's own network.

### Firewall rules: who may knock on which door

A **security group** is a list of **allow** rules attached to a machine: "accept traffic from this address range on this port". Anything not allowed is refused, so a new group lets nothing in. Reading a rule is just the two checks you already know: is the sender's address inside the block, and is it the right port?

:::drill python Is this knock allowed?
Write `allowed(rules, ip, port)`: `rules` is a list of `(cidr, port)` pairs, each an **allow** rule. Return `True` only when some rule's block contains `ip` **and** its port equals `port`. With no matching rule the answer is `False` (anything not allowed is refused).
@starter
import ipaddress
# write your function below this line

@check
defines("allowed") ## Define allowed(rules, ip, port).
allowed([("10.0.0.0/16", 5432)], "10.0.3.7", 5432) == True ## A machine inside the VPC knocks on the database port.
allowed([("10.0.0.0/16", 5432)], "10.1.0.1", 5432) == False ## An address outside the block.
allowed([("10.0.0.0/16", 5432)], "10.0.3.7", 22) == False ## The right address, the wrong door.
allowed([], "10.0.3.7", 5432) == False ## No rules: nothing is allowed.
allowed([("0.0.0.0/0", 5432)], "203.0.113.9", 5432) == True ## 0.0.0.0/0 is the whole internet: the dangerous rule.
@hint
Parse `ip` once with `ipaddress`, then loop over each `(cidr, rule_port)` pair and return `True` as soon as you find one whose network contains the address and whose port matches; return `False` if none match.
@solution
import ipaddress
def allowed(rules, ip, port):
    return any(ipaddress.ip_address(ip) in ipaddress.ip_network(cidr) and p == port for cidr, p in rules)
:::

:::ask A security group has the rule "allow 0.0.0.0/0 on port 5432" and the database port is 5432. Who can now try to connect to the database?
@options
only machines in your own VPC, because 0.0.0.0 means "this network"
* anyone on the internet: like a public bucket
nobody, because a database port is always blocked by default
@why
`0.0.0.0/0` is the CIDR block of every address on the internet. A rule that allows it on a database port opens the door to everyone. The safe version names your own subnet, for example `10.0.0.0/16`, and nothing broader.
:::

### Regions and zones

A cloud **region** is a city, such as Jakarta or Singapore. Inside it sit several **availability zones**, separate buildings with their own power and network. Spreading a service over zones survives the loss of one building. But traffic that crosses zones, or leaves the region, is charged per gigabyte. For a cluster that shuffles terabytes a day, this "invisible" bill becomes real money.

:::ask A private pipeline worker must download a library from the internet, but no one on the internet may be able to open a connection to the worker. What does it need?
@options
a public subnet with a rule allowing 0.0.0.0/0 on every port
a bigger CIDR block, so that the worker has more addresses
* a NAT gateway: outbound access only, no inbound path
@why
A NAT gateway gives a private machine a way out without a way in. A public subnet with open rules would let anyone try to connect. A bigger block changes how many addresses exist, not who can reach the worker.
:::

> 🛠 **Try it (10 min, terminal).** See a port with your own eyes. In the course folder, start the course site in one terminal: `python3 server.py`. In a second terminal run `curl -I http://localhost:3000`. Then stop the server with Ctrl+C in the first terminal and run the same `curl` again.
>
> **You should see:** the first time, a line beginning `HTTP/1.0 200 OK` (the program at door 3000 answered). The second time, `curl: (7) Failed to connect to localhost port 3000 ...` (the exact words depend on your curl version, sometimes "Connection refused"): nothing is listening at that door any more. If you see `Address already in use` when starting the server, another program already holds port 3000.

## @lesson Securing the lakehouse
The lab builds the storage layer of the lakehouse from Module 2.2, with four protections that every company that holds customer data expects.

**1. Block public access.** Breaches like "customer files found in an open bucket" are mostly configuration mistakes. `aws_s3_bucket_public_access_block` with all four flags `true` makes it impossible for a later policy or **ACL** (Access Control List, legacy per-object/bucket permission rules) to expose the bucket, whatever someone writes in a hurry.

**2. Encrypt, with a key you control.** Encryption scrambles a file so that it is unreadable without the right **key**, like a lock that only one key opens. S3 provides **SSE** (Server-Side Encryption) by default, encrypting bytes on disk with a key AWS manages. Using **KMS** (AWS Key Management Service) with a customer-managed key you own adds an access layer (the reader needs permission on the key as well as on the data), an audit trail of every use, and the ability to revoke access centrally. Turn on **key rotation** so that a leaked old key is limited in time.

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

One subtle point from the lab. The IAM policy mentions the bucket's **ARN** (Amazon Resource Name: the full, unique "postal address" of one thing in AWS, in the format `arn:aws:service:region:account:resource`). If you write `aws_s3_bucket.lakehouse.arn`, that value is *known only after apply*, so the planned policy JSON is not visible and the reviewer sees "(known after apply)" instead of the permissions. Building the ARN from the bucket **name** (`arn:aws:s3:::${local.bucket_name}`) makes the entire policy readable at plan time. Design your configuration so that the security-relevant facts are visible in the plan.

**Tags** belong here too. With `default_tags` on the provider, every resource gets `Project`, `Environment`, `Owner` and `CostCenter` automatically, and the lab checks it. Tags are how the invoice becomes understandable in the next lesson.

:::ask Your VPC is `10.0.0.0/16`. You split it into `/20` subnets. How many subnets do you get?
@options
4 subnets, one per step in the prefix
* 16 subnets (four extra prefix bits)
256 subnets, one per host bit
@why
A `/20` has 4 more network bits than a `/16`, so there are 2^4 = 16 subnets, each with 4,096 addresses (4,091 usable on AWS, which reserves 5). Sizing is hard to change later, so plan it before you build.
:::

:::ask A job only needs to read files under `s3://lake/raw/`. Which IAM policy follows least privilege?
@options
`"Action": "s3:*"` on `"Resource": "*"`
the `AdministratorAccess` managed policy
* `"Action": "s3:GetObject"` on `arn:aws:s3:::lake/raw/*`
@why
Least privilege grants only the **actions** and **resources** the job needs: read objects, under one prefix. Wildcards turn one leaked credential into access to everything.
:::

> 💡 **Practice Pause 2 (Lakehouse S3 Security & Least-Privilege IAM Policy):**
> 1. Open `labs/mod-3-4/terraform/main.tf` and `labs/mod-3-4/terraform/outputs.tf` in your text editor.
> 2. Complete the S3 bucket resource, block public access (`aws_s3_bucket_public_access_block` with all four flags set to `true`), customer-managed KMS key with rotation enabled, default SSE encryption, raw storage lifecycle rules, and least-privilege IAM policy restricting actions to silver and gold prefixes.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_terraform.py -v`
> 4. **Success Indicator:** All 12 tests in `test_terraform.py` report `PASSED` (or cleanly skip if CLI is not installed), proving that the offline dev and prod plans satisfy enterprise security standards.

### Who secures what, and the network around the data

**Shared responsibility.** AWS describes the split as security "of" the cloud versus security "in" the cloud. AWS protects the infrastructure: the hardware, software, networking and facilities that run its services. You are responsible for what you build on it, and how much that is depends on the service: on a virtual machine you also patch the operating system; on S3 you configure access, encryption and lifecycle. Every protection above is on your side of the line: the provider will not block public access, write least-privilege policies or rotate your keys for you.

**The network.** A **VPC** (Virtual Private Cloud) is your isolated private network inside one cloud region. You choose its address range in **CIDR** (Classless Inter-Domain Routing) notation: `10.0.0.0/16` means the first 16 bits are fixed, which leaves 2¹⁶ = 65,536 addresses. You cut it into **subnets** (on AWS between `/16` and `/28`), and AWS reserves the first four and the last address of every subnet, so a subnet always holds 5 fewer usable addresses than its size. A **public** subnet has a route to the internet; a **private** one does not. Databases, warehouse compute and pipeline workers belong in private subnets: nothing on the internet can even try to reach them.

Two kinds of firewall rules control traffic, and they behave differently:

| | Security group | Network ACL |
|---|---|---|
| Attached to | a resource (its network interface) | a whole subnet |
| State | **stateful**: the reply to allowed traffic is allowed automatically | **stateless**: replies need their own rule |
| Rules | **allow** rules only; a new group lets nothing in | allow **and** deny rules, numbered |

The everyday tool is the security group: "the warehouse database accepts port 5432 only from the private subnet". A rule with `0.0.0.0/0` (the whole internet) on a database port is the network version of a public bucket.

Pipelines read S3 constantly. Without help, that traffic from a private subnet would need a path to the internet. A **gateway endpoint** for S3 adds a route in the subnet's route table instead, so the data never leaves AWS's network, and AWS documents "no additional charge for using gateway endpoints". Other services can be reached privately through **interface endpoints** (AWS PrivateLink).

**Security as a habit.** *Fundamentals of Data Engineering* separates security theatre (rules on paper) from security habits (what you do every day). The habits that matter most in data work: least privilege by default; nothing public without a written reason; secrets never in code (Module 0.1); assume credentials will leak one day and limit what they can reach; read every plan for security-relevant changes; and run `plan` on a schedule so that a hand-made change is found by you, not by an attacker.

**Keyless cloud authentication (Workload Identity / OIDC vs. static access keys).** A long-lived static key (`AWS_ACCESS_KEY_ID` or a downloaded GCP service-account `.json` file) is dangerous because it works for anyone who finds it, from anywhere, until someone notices and revokes it; keys committed to Git or left on a laptop are exactly how that happens. In production, modern data platforms use **short-lived, keyless identity**:
- A job running on EC2, ECS, EKS, Cloud Run, or GKE assumes an **attached IAM Role / Service Account** (via AWS IAM Roles for Service Accounts / IRSA, GCP Workload Identity, or Azure Managed Identity). The platform hands the container temporary credentials that expire and are rotated automatically.
- A GitHub Actions CI/CD pipeline running `terraform plan` or `dbt build` authenticates via **OpenID Connect (OIDC) federation**: GitHub presents a signed token for that exact repository and branch, and the cloud's token service returns temporary credentials (for `aws-actions/configure-aws-credentials` the default lifetime is one hour, adjustable with `role-duration-seconds`). No long-lived secret is stored in GitHub.

**Multi-Cloud Rosetta Stone (AWS vs. GCP vs. Azure for Data Engineers).** Of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20), **65.3%** name at least one major cloud (AWS, GCP or Azure). Because the underlying physics and primitives are the same, learn the concept once and translate the service names across all three clouds:

| Cloud Capability | Amazon Web Services (AWS) | Google Cloud Platform (GCP) | Microsoft Azure |
|---|---|---|---|
| **Object Storage (Lakehouse Base)** | Amazon S3 (`s3://`) | Google Cloud Storage (`gs://`) | Azure Data Lake Storage Gen2 (`abfss://`) |
| **Keyless Workload Identity & IAM** | IAM Roles, STS & IRSA (OIDC) | IAM Service Accounts & Workload Identity | Entra ID (Azure AD) Managed Identities |
| **Customer-Managed Encryption & Secrets** | AWS KMS + Secrets Manager | Cloud KMS + Secret Manager | Azure Key Vault |
| **Private Network Access to Storage** | S3 Gateway Endpoint & AWS PrivateLink | Private Google Access & Private Service Connect | Virtual Network Service Endpoints & Private Link |
| **Cloud Data Warehouse** | Amazon Redshift (RA3 / Serverless) | Google BigQuery (On-Demand / Editions) | Azure Synapse Analytics / Microsoft Fabric |
| **Managed Spark & Lakehouse Compute** | AWS EMR / AWS Glue / Databricks | Cloud Dataproc / BigQuery Spark | Azure Databricks / HDInsight / Fabric |
| **Event Streaming & Messaging** | Amazon MSK (Kafka) / Kinesis | Cloud Pub/Sub / Managed Kafka | Azure Event Hubs |

> 🛠 **Try it (10 min, Python).** Your VPC is `10.0.0.0/16`. With the `ipaddress` module, split it into `/20` subnets. How many are there, how many addresses does each hold, and how many can you use on AWS? Which subnet contains `10.0.37.5`? How many `/24` subnets fit into one `/20`?
>
> **You should see:** `16` subnets of `4096` addresses, `4091` usable on AWS (5 reserved); `10.0.37.5` sits in `10.0.32.0/20`, the third subnet; and one `/20` holds `16` `/24`s. Sizing is hard to undo: change a subnet's range and Terraform's plan says the subnet `must be replaced` (`# forces replacement`), so everything running in it has to move. Leave room to grow.

> 🛠 **Try it (25 min, terminal, optional: needs the fake AWS from the last lesson of this module).** In a new folder, copy the lab's `versions.tf` and `labs/mod-3-4/local-aws/local_aws_override.tf`, add a provider block with `region = "ap-southeast-3"`, and write the network yourself: a VPC `10.0.0.0/16`; a public and a private subnet made with `cidrsubnet(…, 4, 0)` and `cidrsubnet(…, 4, 1)`; a route table associated with the private subnet; a security group `warehouse-db` that allows TCP 5432 only from the private subnet's range; and an S3 gateway endpoint (`com.amazonaws.ap-southeast-3.s3`) on that route table. Apply it, then check with `aws --endpoint-url http://127.0.0.1:5055 ec2 describe-subnets --query 'Subnets[].[CidrBlock,AvailableIpAddressCount]'`. Finally open the database to the world by hand, `aws --endpoint-url http://127.0.0.1:5055 ec2 authorize-security-group-ingress --group-id <your group id> --protocol tcp --port 5432 --cidr 0.0.0.0/0`, and run `terraform plan -detailed-exitcode`.
>
> **You should see:** `Apply complete! Resources: 7 added` (about 15 seconds); both subnets with `4091` available addresses, the number from the first Try it; and a route in the private route table to an S3 prefix list (`pl-…`) through the endpoint (`vpce-…`). After the hand-made change the plan exits with code `2`, says the security group `will be updated in-place`, shows `- "0.0.0.0/0"` and ends with `Plan: 0 to add, 1 to change, 0 to destroy.`; `apply` removes the hole. Measured with Terraform 1.17.2, AWS provider 5.100.0 and moto 5.2.5; `destroy` takes about 17 seconds.

## @part Cost and architecture

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

:::ask Pipelines in a private subnet read S3 all day through a NAT gateway, which charges per GB processed. What is the cheaper, more private path?
@options
a bigger NAT gateway with higher throughput capacity
* an S3 gateway endpoint to bypass the NAT
send the data over the public internet
@why
A gateway endpoint adds a route to S3 without sending the traffic through the NAT gateway, so there is no per-GB NAT processing charge and the traffic never leaves the AWS network. Network paths are a bill line, not an afterthought.
:::

> 💡 **Practice Pause 3 (FinOps Warehouse Cost Modeling & Tag Allocation):**
> 1. Open `labs/mod-3-4/finops.py` in your text editor.
> 2. Implement `query_cost(seconds, credits_per_hour, price_per_credit)` for warehouse compute costs, `billed_seconds(queries, auto_suspend_s, minimum_s)` modeling idle tails and 60-second minimums, and `cost_by_tag(log)` allocating total spend per team.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestQueryCost or TestBilledSeconds or TestCostByTag" -v`
> 4. **Success Indicator:** All 14 tests report `PASSED` in milliseconds in pure Python, validating warehouse uptime billing and team cost allocation.

## @lesson Guardrails, budgets and forecasts
:::talk The query that ran all night
@teacher An analyst starts a huge query at 18:00 and goes home. It runs on a large warehouse, billed per second, until 05:00 the next morning. The bill for that one query is a shock. Nobody was watching.
@ask Which control would have stopped it automatically, at the lowest cost?
@choice * A statement timeout on the warehouse, plus a budget alert that pages someone when spend is unusual | Yes. A timeout kills any query that runs too long, with no human needed, and the alert catches strange spending early. Both cost almost nothing.
@choice A bigger warehouse, so the query finishes faster | A bigger warehouse costs more per second and can make a runaway query more expensive. Try again.
@choice A weekly email reminding the team to be careful | Reminders do not stop a query at 02:00. Controls must act without a person. Try again.
@teacher Guardrails are limits that work while you sleep: timeouts, budgets, alerts and quotas, set before the incident, not after.
:::

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

:::advanced A production CI/CD pipeline for Terraform (GitHub Actions)
**Production GitHub Actions CI/CD Workflow for Terraform (Keyless OIDC + Trivy Security Scan + Plan Review).** Here is the standard GitOps pipeline used by production data engineering teams to lint, scan, estimate cost, and apply Terraform without storing a single static AWS access key in GitHub:

```yaml
# .github/workflows/terraform-lakehouse.yml
name: Terraform Lakehouse CI/CD
on:
  pull_request:
    paths: ["terraform/**"]
  push:
    branches: ["main"]
    paths: ["terraform/**"]

permissions:
  id-token: write        # Required for keyless AWS OIDC federation
  contents: read
  pull-requests: write   # Required to post terraform plan output on the PR

jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: terraform
    steps:
      - uses: actions/checkout@v5
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: "1.17.2"

      # 1. Fast static checks (zero cloud credentials needed)
      - name: Format & Syntax Check
        run: |
          terraform fmt -check -recursive
          terraform init -backend=false
          terraform validate

      # 2. Policy-as-Code Security Scan (Fails PR on public S3, missing KMS, or wildcard IAM '*')
      - name: Trivy IaC Security Scan
        uses: aquasecurity/trivy-action@v0.36.0   # pin a release (or a commit SHA), never @master
        with:
          scan-type: "config"
          scan-ref: "terraform/"
          exit-code: "1"
          severity: "HIGH,CRITICAL"

      # 3. Keyless OIDC Authentication to AWS (temporary credentials, one hour by default)
      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsTerraformRole
          aws-region: ap-southeast-3

      # 4. Plan against remote state with DynamoDB/S3 state locking
      - name: Terraform Init & Plan
        run: |
          terraform init
          terraform plan -var-file=prod.tfvars -out=tfplan

      # 5. Apply ONLY after PR is reviewed and merged to main
      - name: Terraform Apply (Main Branch Only)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan
```
:::

> 💡 **Practice Pause 4 (FinOps Guardrails: Runaway Detection, Forecasting & Storage Tiering):**
> 1. Open `labs/mod-3-4/finops.py` in your text editor.
> 2. Implement `find_runaway(log, factor)` using team median duration to flag extreme outliers, `forecast_month(daily_costs, days_in_month, budget)` projecting the day a monthly budget breaches, and `storage_cost(objects, archive_after_days)` modeling cold archive storage vs retrieval economics.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestFindRunaway or TestForecast or TestStorageCost" -v`
> 4. **Success Indicator:** All 15 tests report `PASSED` in milliseconds in pure Python, proving query outlier detection, monthly budget forecasting, and storage tiering trade-offs work accurately.

*(Browser warm-up: this simplified 2-argument `forecast_month(daily_costs, days_in_month)` drill practices the projection math independently of `finops.py`'s 3-argument version.)*

:::drill python Forecast the month
Write `forecast_month(daily_costs, days_in_month)`: `daily_costs` is the list of costs so far this month, one per day. Project the rest of the month with the **average of the last 7 days** (or of all days, if there are fewer than 7). Return the spend so far plus that average times the days still to come.
@starter
# write your function below this line

@check
defines("forecast_month") ## Define forecast_month(daily_costs, days_in_month).
forecast_month([10] * 10, 30) == 300 ## Steady 10 per day: 100 so far + 20 days × 10.
forecast_month([10] * 7 + [20] * 7, 30) == 530 ## 210 so far; the last 7 days average 20, and 16 days remain: 210 + 320.
forecast_month([10, 20], 30) == 450 ## Fewer than 7 days: average all of them (15), 28 days remain: 30 + 420.
forecast_month([10] * 30, 30) == 300 ## The month is over: nothing left to project.
@hint
Slice up to the last 7 entries of `daily_costs` to get their mean daily rate, multiply that rate by the remaining days in the month, and add it to the total spent so far.
@solution
def forecast_month(daily_costs, days_in_month):
    recent = daily_costs[-7:]
    avg = sum(recent) / len(recent)
    return sum(daily_costs) + avg * (days_in_month - len(daily_costs))
:::

:::ask Which guardrail stops a runaway cross join on Friday night before the weekend bill grows?
@options
a budget report emailed at the month end
a reminder in the team chat to be careful
* a statement timeout on warehouses and accounts
@why
Controls must be automatic: a one-hour timeout kills the query by itself. A month-end report is an autopsy, and reminders depend on people at 22:30 on a Friday.
:::

## @lesson Under the cloud: storage speeds, network charges and choosing technology
> **In short:** The cloud is still made of disks, memory and network cables, and each layer down is many times slower than the one above it. Moving data between zones, regions and the internet is billed per gigabyte, and on a busy cluster that can cost more than the computing. When you choose a technology, count the engineering time it will eat as well as the bill, and prefer decisions you can undo.

This lesson draws on chapters 3, 4 and 6 and appendix B of *Fundamentals of Data Engineering*.

### 1. How far away is the data?
Typical first-byte latency for each layer, and where a data engineer meets it:

| Layer | Typical latency | Where you meet it |
|---|---|---|
| CPU caches | about 1 to 10 nanoseconds | Vectorised engines (DuckDB, Arrow) work on batches that fit in cache |
| Memory (RAM) | about 100 nanoseconds | Hash tables for joins, broadcast joins, Redis, vector indexes |
| Local NVMe SSD | about 0.1 milliseconds | Streaming state (RocksDB), Spark shuffle spill, warehouse caches |
| Network disk (EBS) or hard disk | about 1 to 10 milliseconds | PostgreSQL data files, Kafka log segments |
| Object storage (S3, GCS) | tens of milliseconds per request | Lakehouse Parquet and Iceberg files |
| Archive (S3 Glacier) | minutes to hours to restore | Old raw data kept for audits |

The jump from memory to object storage is a factor of hundreds of thousands. That is why each request to S3 should fetch a lot of data (files of 100 MB or more, not millions of tiny ones; Module 3.0) and why a job that spills to disk suddenly slows down.

### 2. Network charges
Inside one *availability zone* (AZ: one data centre within a region), traffic between machines is normally free. Beyond that, on AWS at list prices (check the current pricing page; other clouds are similar):

- **Between zones in the same region:** $0.01 per GB charged on each side, so $0.02 for every GB that crosses. A cluster spread over three zones that shuffles 50 TB a day sends about two thirds of it to another zone: 33,000 GB × $0.02 ≈ **$667 a day, about $20,000 a month**, just for moving data.
- **Between regions, or out to the internet:** about $0.02 to $0.09 per GB. Keep compute in the same region as its storage. This is called *data gravity*: data is expensive to move, so the work goes to the data.
- **NAT gateway:** (Network Address Translation — lets servers in a private subnet open outbound requests without letting anyone on the internet initiate inbound connections) traffic from private machines to S3 through a NAT gateway pays a $0.045 per GB processing fee. An *S3 gateway endpoint* sends the same traffic for free.

### 3. Choosing technology
- **Reversible and irreversible decisions.** Storing tables in an open format (Parquet, Iceberg) is easy to undo: you can switch from DuckDB to Trino or Spark without moving the data. Putting all business logic in one vendor's stored procedures is hard to undo. Spend your care on the hard-to-undo decisions.
- **Total cost of ownership and opportunity cost.** The book separates the total cost of ownership (licences, cloud bill, people) from the *opportunity cost*: what your team does not build while it runs the system. A "free" self-hosted cluster that keeps three engineers busy for five months has cost five months of other work.
- **Benchmarks.** Be wary of vendor benchmarks: tiny datasets ("big data for the 1990s", as the book puts it), a tuned system against an untuned competitor, comparisons that are not like for like. Test on your own queries, data skew and number of users.

> 🛠 **Try it (10 min, paper).** A Spark job shuffles 20 TB a day across nodes in three zones, and two thirds of that traffic crosses a zone boundary. It also reads 5 TB a day from S3 through a NAT gateway. Using the prices above, work out the network cost of 30 days. Then name two changes that remove most of it, and say what each one saves.
>
> **You should see:** cross-zone: 13,333 GB × $0.02 ≈ $267 a day; NAT: 5,000 GB × $0.045 = $225 a day; together about $492 a day, or about $14,750 for 30 days. Running the shuffle inside one zone saves about $8,000 a month, but if that zone fails the job stops, which is a trade-off worth saying out loud. An S3 gateway endpoint saves the $6,750 of NAT fees at no risk. Together they remove almost all of it.

### 4. Designing for failure and for change
These ideas from chapter 3 of the book come up in every system design interview, and each one is a decision with a number behind it, not a slogan.

**Plan for failure: RTO and RPO.** Agree two numbers with the business before you choose a backup scheme. The **recovery time objective** (RTO) is how long a system may be down. The **recovery point objective** (RPO) is how much data, measured in time, you may lose. A nightly backup means you can lose up to a day of data; if the business says "at most 15 minutes", you need continuous replication of the database log (the same log that change data capture reads, Module 3.2). For a lakehouse, keeping the raw files immutable (Module 2.2) is your best protection: every derived table can be rebuilt from them, so the real question becomes how long that rebuild takes. And restore a backup on purpose now and then: a backup nobody has restored is a hope, not a plan.

**Loose coupling.** When service A calls B, which calls C, and each must answer before the next can continue, their availabilities multiply: three services that are each up 99.9% of the time are together up only about 99.7% of the time. **Loose coupling** breaks the chain: the producer writes events to a log or a queue (Kafka, Module 3.2) or files to object storage, and each consumer reads at its own pace. If a consumer fails, the producer keeps going and the consumer catches up later (its lag, Module 3.3). That is **event-driven architecture**. The opposite trap is the **distributed monolith**: services that must be deployed together, share one database schema and call each other in long synchronous chains. It has all the costs of a distributed system and none of the independence. A single, well-structured application (a *modular monolith*) is often the better place to start.

**Boring technology lasts.** The book separates *immutable* technologies, which have lasted for decades and will likely last decades more, from *transitory* ones that come and go. The rule of thumb behind it, the *Lindy effect*, says that the longer a technology has already lasted, the longer it is likely to last. SQL and the Unix shell date from the 1970s; object storage and columnar files are the base of every lakehouse. Learn those deeply, and treat the tool of the month around them as a layer you can replace (a reversible decision, section 3).

**Cloud or your own servers.** The cloud wins when load is unpredictable or the company is small and its future uncertain; renting capacity that runs at full load 24 hours a day adds up. In June 2023, 37signals (the company behind Basecamp and HEY) wrote that it had left the cloud and that "the back of the napkin math is that we'll save at least $1.5 million per year by owning our own hardware rather than renting it from Amazon", without growing its operations team. The same posts name the conditions: growth that is "mostly predictable" and expert staff to run the machines, and they say the cloud still makes sense for companies whose spend is small or whose future is uncertain. For most data teams starting out, people cost more than servers, so managed services usually win; revisit the question when the bill is large and the load is flat.

> 🛠 **Try it (10 min, Python or paper).** A dashboard request passes through three services that each must answer, and each is available 99.9% of the time. Work out the availability of the chain and the minutes of downtime in a 30-day month (43,200 minutes), for one service and for the chain of three; then for a chain of five. Next, the database behind it is backed up every 6 hours: what is the worst and the average data loss if it fails at a random moment? What would an RPO of 15 minutes require?
>
> **You should see:** one service: 99.90% and `43.2` minutes; three in a chain: 99.70% (`0.999 ** 3`) and `129.5` minutes, three times the downtime; five: 99.50% and `215.6` minutes. With a backup every 6 hours you lose up to 6 hours of data and 3 hours on average; 15 minutes needs a backup or log shipping at least every 15 minutes, usually continuous replication. Decoupling the chain with a queue would let the first service keep accepting work while a later one is down.

> 🛠 **Try it (5 min, Python or paper).** A company wants to move 100 TB of history into the cloud. How many days does it take over a 1 Gbit/s line at full speed, over the same line when only 70% of it is usable in practice, and over a 100 Mbit/s office line? (1 TB = 10¹² bytes, 1 byte = 8 bits.)
>
> **You should see:** `9.3` days at full speed, `13.2` days at 70%, and `92.6` days over 100 Mbit/s; a 10 Gbit/s line at 70% would take `1.3` days. When the network needs weeks, shipping disks wins: this is why the big clouds rent out physical transfer appliances (on AWS: Snowball) that you fill on site and send back by courier.

> 🛠 **Try it (20 min, in your own terminal).** Combine three calculations from this module into one script, `~/practice/cloud_architect.py`, with three functions:
> 1. `plan_iac_diff(desired, actual)`: both arguments map `resource_name -> properties_dict`. Return a list of `(action, resource_name)` tuples sorted by name, with `"create"` for a resource only in `desired`, `"destroy"` for one only in `actual`, and `"update"` when both have it with different properties. Leave out unchanged resources (the planner from lesson 1).
> 2. `audit_vpc_and_egress(vpc_cidr, new_prefix, daily_shuffle_gb, zones, daily_s3_gb, has_s3_endpoint)`: split `vpc_cidr` (for example `"10.0.0.0/16"`) into subnets of size `/new_prefix` and return a dict with `num_subnets`; `usable_ips_per_subnet` on AWS (lesson 4); `monthly_cross_az_usd`, the 30-day cost of the daily shuffle at $0.02 per GB, assuming the data is spread evenly over `zones` zones so only the share that leaves a node's own zone is charged (nothing with one zone); `monthly_nat_s3_usd`, 30 days of S3 traffic through a NAT gateway at $0.045 per GB, or `0.0` when `has_s3_endpoint` is true; and `monthly_endpoint_savings_usd`, what an S3 gateway endpoint saves in 30 days. Round dollar amounts to 2 decimals.
> 3. `chain_sla_and_rpo(num_services, service_sla, backup_interval_hours, target_rpo_minutes)`: for `num_services` services called one after another, each available `service_sla` of the time (for example `0.999`), return `combined_sla` rounded to 6 decimals, `monthly_downtime_min` in a 30-day month (43,200 minutes) rounded to 1 decimal, and `needs_continuous_cdc`: `True` when the backups are further apart than the target RPO allows (section 4 of this lesson).
>
> **Check it:** `python3 labs/tryit/check.py 3.4-1 ~/practice` (stuck? add `--hint 1`, then 2 and 3)

:::ask A cluster in three zones shuffles 50 TB a day. Why can this be a surprising line on the bill?
@options
* two thirds of data crosses zones, and is charged
traffic inside a single region is always free
shuffles are billed only on the first day
@why
Traffic between zones costs money (in the lesson $0.02 per GB crossing). 33,000 GB at that rate is a real daily cost that no query plan shows. Keep chatty jobs inside one zone when you can.
:::

## @part Optional: apply it for real

## @lesson Apply it for real, on a fake AWS on your laptop {optional}
The lab only *plans*: the provider uses fake credentials and never talks to AWS. The other half of Terraform's job, actually creating, checking, repairing and destroying resources, needs an AWS endpoint. A real AWS account needs a payment card; **moto** needs nothing. It is an open-source Python program that answers the same API calls as AWS (S3, IAM, KMS and many more) on your own computer. Terraform, the `aws` command line and `boto3` cannot tell the difference, so you practise the real tools and the real workflow; only the cloud behind them is pretend.

**What a fake AWS cannot teach.** moto does not check permissions unless you ask it to, so an IAM policy that would be denied in a real account still works here; it has no prices and no real network delays; and some services are only partly implemented. Treat it as a flight simulator: the controls and procedures are real, the consequences are not.

**Set up (once, in your venv):** install the fake AWS and the AWS command line, then start the fake AWS in its **own** terminal and leave it running:

```bash
python -m pip install "moto[server]" awscli
moto_server -p 5055
```

In your working terminal, give the tools dummy credentials and copy **your** Terraform project from the lab, plus the override file that points it at port 5055. Work in the copy, so the offline lab tests keep working:

```bash
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=ap-southeast-3
cp -r labs/mod-3-4/terraform ~/tf-local
cp labs/mod-3-4/local-aws/local_aws_override.tf ~/tf-local/
cd ~/tf-local && terraform init && terraform apply -var-file=dev.tfvars
```

Terraform merges any file whose name ends in `_override.tf` into the matching block, so your `provider.tf` stays unchanged. Read the plan before you type `yes`. Then look at what you built with the same commands you would use on real AWS, for example `aws --endpoint-url http://127.0.0.1:5055 s3api get-bucket-tagging --bucket kopiku-lakehouse-dev`.

**Measured** with the lab's reference project (Terraform 1.17.2, AWS provider 5.100.0, moto 5.2.5): `apply` created **7 resources** in **64 seconds**, 55 of them spent on the lifecycle rule, because the provider waits and re-checks after creating it, as it does on real AWS. The bucket carried the five cost tags from `default_tags`. A second `terraform plan` printed `No changes. Your infrastructure matches the configuration.`, and `terraform destroy` removed all 7 in about 14 seconds.

> 🛠 **Try it (15 min, terminal, needs the setup above).** Practise **drift**: a change made by hand outside Terraform. With your project applied, remove the bucket's public access protection the way a hurried colleague might: `aws --endpoint-url http://127.0.0.1:5055 s3api delete-public-access-block --bucket kopiku-lakehouse-dev`. Run `terraform plan -var-file=dev.tfvars -detailed-exitcode` and note the exit code with `echo $?`. Then `apply` to repair it, `plan` once more, and finally `terraform destroy -var-file=dev.tfvars`.
>
> **You should see:** the plan finds the drift: `Plan: 1 to add, 0 to change, 0 to destroy.` for `aws_s3_bucket_public_access_block.lakehouse`, and exit code `2` (changes needed; `0` means none). `apply` reports `1 added`, the next plan `No changes`, and `destroy` reports `7 destroyed`. This is why teams run `terraform plan` on a schedule: drift is silent until a plan shows it, and an open bucket is exactly the drift that leaks data.

## @lab Lab: a secure lakehouse bucket and a cost guardrail toolkit
Part A: finish a Terraform configuration until an offline plan proves the bucket is private, encrypted, lifecycle-managed, tagged and accessible only through a least-privilege policy. Part B: write the Python functions behind your FinOps controls: warehouse billing, cost by team, runaway detection, a budget forecast and storage tiering.

### @steps
> Already finished Parts A and B during Practice Pauses 1–4? Skip straight to Step 7 and Practice Pause 5 to verify both suites and generate your proof token.

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
6. **Part B.** Open `labs/mod-3-4/finops.py` and implement the six functions (`query_cost`, `billed_seconds`, `cost_by_tag`, `find_runaway`, `forecast_month`, `storage_cost`). The query log comes from `labs/shared/querylog.py`: print the first rows and the largest query before you start. Run `pytest labs/mod-3-4/test_finops.py -v`.
7. Use your functions to answer: what auto-suspend would you choose for the shared warehouse and why? Which team paid for the 11-hour query? Add up each day's cost and try `forecast_month` with a $75 budget: what does it say on day 15, and on day 16 (the day the runaway starts)? Why is the day-16 forecast too pessimistic, and how could `find_runaway` improve it?

> 💡 **Practice Pause 5 (Full Verification & Proof Token):**
> 1. In terminal, run both the Terraform (Part A) and FinOps (Part B) test suites:
>    `pytest labs/mod-3-4/test_terraform.py labs/mod-3-4/test_finops.py -v`
> 2. Generate the verification proof token (requires Terraform CLI installed so Part A is not skipped):
>    `python3 scripts/prove.py mod-3-4`
> 3. **Success Indicator:** All 41 tests (12 Terraform + 29 FinOps) report `PASSED` and your completion proof token is printed to terminal.

### @files
- labs/mod-3-4/terraform/variables.tf :: Part A: declare the input variables :: starter
- labs/mod-3-4/terraform/main.tf :: Part A: the lakehouse resources (follow the TODO list) :: starter
- labs/mod-3-4/terraform/outputs.tf :: Part A: outputs :: starter
- labs/mod-3-4/terraform/provider.tf :: Provider with offline settings and default tags (provided) :: config
- labs/mod-3-4/terraform/versions.tf :: Required Terraform and provider versions (provided) :: config
- labs/mod-3-4/terraform/dev.tfvars :: Dev values (provided) :: config
- labs/mod-3-4/terraform/prod.tfvars :: Prod values (provided) :: config
- labs/mod-3-4/test_terraform.py :: Part A tests (12, from the planned JSON) :: test
- labs/mod-3-4/finops.py :: Part B working file: six cost functions :: starter
- labs/mod-3-4/test_finops.py :: Part B tests (29) :: test
- labs/shared/querylog.py :: Deterministic 30-day query log with a planted runaway :: data
- labs/mod-3-4/requirements.txt :: pytest and installation notes :: config
- labs/mod-3-4/local-aws/local_aws_override.tf :: Optional lesson: points the provider at a fake AWS on your laptop (moto) :: config
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
python3 scripts/prove.py mod-3-4
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

### A Spark cluster spread over three availability zones shuffles 50 TB a day, and two thirds of it crosses a zone. At $0.02 per GB that crosses, what does the moving cost per day?
- [ ] About $1,000, because every gigabyte of the shuffle is charged
- [ ] Nothing, because traffic inside one region is always free of charge
- [ ] About $0.67, because the fee is charged per terabyte, not per gigabyte
- [x] About $667, from 33,000 GB × $0.02 for the traffic crossing a zone

> Only traffic that leaves a zone is billed: two thirds of 50,000 GB is about 33,000 GB, times $0.02. That is about $20,000 a month for moving data alone.

### Which of these decisions is the easiest to undo later?
- [ ] Putting all business logic in one vendor's stored procedures
- [x] Storing the tables in an open format such as Parquet or Iceberg
- [ ] Building every report directly on the production application database
- [ ] Writing the pipelines in a language that only one engineer on the team knows

> With an open format you can switch from DuckDB to Trino or Spark without moving the data. Spend your care on the decisions that are hard to undo.

## @resources
- [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- [Terraform AWS provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [OpenTofu](https://opentofu.org/docs/)
- [AWS IAM: security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Amazon S3 storage classes](https://aws.amazon.com/s3/storage-classes/)
- [FinOps Foundation: framework and principles](https://www.finops.org/framework/)
- [Checkov: policy-as-code scanner for Terraform](https://www.checkov.io/)
- [Infracost: cloud cost estimates in pull requests](https://www.infracost.io/docs/)
