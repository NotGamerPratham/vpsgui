# Security Policy & RBAC Permissions Matrix

VPSGUI takes infrastructure security seriously.

## Role-Based Access Control (RBAC)

| Role | Nodes & Server Access | Docker Control | Secrets Management | System Preferences |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full Access | Full Access | Full Access | Full Access |
| **Admin** | Full Access | Full Access | Full Access | View Only |
| **DevOps Engineer** | Manage Nodes | Manage Containers | Read Secrets | Restricted |
| **Viewer** | View Telemetry | View Containers | No Access | Restricted |

## Reporting Security Vulnerabilities

Please report security issues to `security@vpsgui.dev`.
