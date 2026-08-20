import type { CodeSample } from '@/types';

import { site } from './site';

/**
 * Both samples are copied from the SDK READMEs and compile against the
 * published packages. The token is read from the environment in each one on
 * purpose: it is root-equivalent, and a landing page is the last place a
 * hardcoded-credential example should be normalised.
 */
export const sdkSamples: CodeSample[] = [
  {
    id: 'node',
    label: 'Node.js',
    install: 'npm install vpsgui',
    language: 'typescript',
    registryUrl: site.packages.npm,
    code: `import { VpsguiClient } from 'vpsgui';

const client = new VpsguiClient({
  baseUrl: 'https://vps.example.com/api/v1',
  token: process.env.VPSGUI_AGENT_TOKEN!,
});

const telemetry = await client.system.telemetry();
console.log(\`CPU \${telemetry.cpuPercent}% / \${telemetry.cpuCores} cores\`);

for (const c of await client.docker.listContainers()) {
  console.log(c.name, c.state, c.image);
}`,
  },
  {
    id: 'python',
    label: 'Python',
    install: 'pip install vpsgui',
    language: 'python',
    registryUrl: site.packages.pypi,
    code: `import os
from vpsgui import VpsguiClient

with VpsguiClient(
    base_url="https://vps.example.com/api/v1",
    token=os.environ["VPSGUI_AGENT_TOKEN"],
) as client:
    telemetry = client.system.telemetry()
    print(f"CPU {telemetry['cpuPercent']}% / {telemetry['cpuCores']} cores")

    for c in client.docker.list_containers():
        print(c["name"], c["state"], c["image"])`,
  },
  {
    id: 'curl',
    label: 'curl',
    install: 'curl --version',
    language: 'bash',
    registryUrl: site.docs.apiReference,
    code: `# Health is the only unauthenticated route.
curl -s https://vps.example.com/api/v1/health

# Everything else wants the bearer token.
curl -s https://vps.example.com/api/v1/system/telemetry \\
  -H "Authorization: Bearer $VPSGUI_AGENT_TOKEN"

# POST bodies are JSON.
curl -s https://vps.example.com/api/v1/docker/containers/action \\
  -H "Authorization: Bearer $VPSGUI_AGENT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"a1b2c3","action":"restart"}'`,
  },
];
