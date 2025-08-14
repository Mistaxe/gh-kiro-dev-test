# Product Overview

## Behavioral Health Coordination Platform

A multi-tenant SaaS platform for behavioral health coordination that enables secure collaboration between healthcare providers, community helpers, and clients while maintaining strict PHI/PII protection.

### Key Features

- **Multi-tenant architecture** with hierarchical tenancy (Region → Network → Organization → Service Location)
- **Hybrid RBAC/PBAC authorization** using Casbin with comprehensive audit logging
- **Cross-org client identity management** with privacy-preserving fingerprinting and consent-based linking
- **Helper ecosystem support** for community helpers with appropriate access controls
- **Service registry and availability management** with real-time bed/slot tracking
- **Comprehensive Lab/Test Harness** for development and verification of complex authorization behaviors

### Core Principles

- **Security by Default**: Deny-by-default authorization with defense-in-depth through RLS
- **Privacy First**: PHI/PII redaction by default with explicit consent gates
- **Audit Everything**: Comprehensive logging of all authorization decisions and data access
- **Developer Experience**: Rich testing tools and development aids

### Target Users

- Healthcare providers (case managers, clinicians, administrators)
- Community helpers (basic and verified helpers)
- Regional/network administrators
- Compliance officers and auditors