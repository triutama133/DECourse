"""Reference solution for Try-It 3.4-1: Cloud Architecture, VPC Egress & Declarative IaC Planner."""
import ipaddress


def plan_iac_diff(desired, actual):
    actions = []
    for name in sorted(set(desired) | set(actual)):
        if name not in actual:
            actions.append(("create", name))
        elif name not in desired:
            actions.append(("destroy", name))
        elif desired[name] != actual[name]:
            actions.append(("update", name))
    return actions


def audit_vpc_and_egress(vpc_cidr, new_prefix, daily_shuffle_gb, zones, daily_s3_gb, has_s3_endpoint):
    net = ipaddress.ip_network(vpc_cidr)
    num_subnets = 2 ** (int(new_prefix) - net.prefixlen)
    usable_ips = (2 ** (32 - int(new_prefix))) - 5
    cross_az = round(float(daily_shuffle_gb) * ((zones - 1) / zones) * 0.02 * 30, 2) if zones > 1 else 0.0
    savings = round(float(daily_s3_gb) * 0.045 * 30, 2)
    nat_s3 = 0.0 if has_s3_endpoint else savings
    return {
        "num_subnets": num_subnets,
        "usable_ips_per_subnet": usable_ips,
        "monthly_cross_az_usd": cross_az,
        "monthly_nat_s3_usd": nat_s3,
        "monthly_endpoint_savings_usd": savings,
    }


def chain_sla_and_rpo(num_services, service_sla, backup_interval_hours, target_rpo_minutes):
    raw_sla = float(service_sla) ** int(num_services)
    return {
        "combined_sla": round(raw_sla, 6),
        "monthly_downtime_min": round((1.0 - raw_sla) * 43200, 1),
        "needs_continuous_cdc": bool(float(backup_interval_hours) * 60 > float(target_rpo_minutes)),
    }
