import React, { useState } from 'react';
import { Layers, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export function IacPage() {
  const [selectedFormat, setSelectedFormat] = useState<'terraform' | 'ansible' | 'compose' | 'helm' | 'cloudinit'>('terraform');
  const [copied, setCopied] = useState(false);

  const snippets = {
    terraform: `# Terraform Infrastructure Provisioning
provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_server" "web_gateway" {
  name        = "vps-us-east-prod-01"
  image       = "ubuntu-24.04"
  server_type = "cpx31"
  location    = "ash"
  ssh_keys    = [hcloud_ssh_key.default.id]
}`,
    ansible: `# Ansible Playbook Provisioning
- name: Configure VPSGUI Node Infrastructure
  hosts: vps_nodes
  become: yes
  tasks:
    - name: Update Apt Repositories
      apt:
        update_cache: yes
    - name: Install Docker & Docker Compose
      apt:
        name:
          - docker.io
          - docker-compose-v2
        state: present`,
    compose: `version: '3.8'
services:
  nginx:
    image: jc21/nginx-proxy-manager:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./data:/data`,
    helm: `apiVersion: v2
name: vpsgui-cluster
description: Helm Chart for VPSGUI Agent & Metrics Daemon
type: application
version: 1.0.0`,
    cloudinit: `#cloud-config
package_update: true
packages:
  - curl
  - git
  - docker.io
runcmd:
  - curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | bash`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[selectedFormat]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>Infrastructure as Code (IaC) Generator</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Declarative IaC export for Terraform HCL, Ansible Playbooks, Docker Compose, Helm Charts, and Cloud-Init user-data scripts.
          </p>
        </div>

        <Button onClick={copyCode} className="gap-1.5 text-xs bg-primary">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? 'Copied IaC' : 'Copy HCL Code'}</span>
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-muted/30 p-1.5 rounded-lg border border-border/60 overflow-x-auto">
        {(['terraform', 'ansible', 'compose', 'helm', 'cloudinit'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setSelectedFormat(fmt)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md font-mono uppercase transition-all ${
              selectedFormat === fmt ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      <Card className="bg-slate-950 border-border/70 p-4 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
        <pre>{snippets[selectedFormat]}</pre>
      </Card>
    </div>
  );
}
