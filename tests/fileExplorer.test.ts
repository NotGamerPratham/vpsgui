import { describe, expect, it } from 'vitest';

import { describeSystemRisk } from '../src/lib/systemPaths';
import { iconForFile } from '../src/lib/fileIcons';
import { FileItem } from '../src/types/file';

function entry(partial: Partial<FileItem> & { name: string }): FileItem {
  return {
    path: `/tmp/${partial.name}`,
    size: 0,
    sizeBytes: 0,
    type: 'file',
    isDirectory: false,
    permissions: '0644',
    owner: '0',
    group: '0',
    modifiedAt: null,
    ...partial,
  };
}

describe('describeSystemRisk', () => {
  it('returns null for an ordinary file the agent did not flag', () => {
    expect(describeSystemRisk('/home/deploy/app/index.js', false)).toBeNull();
  });

  it('names the specific consequence for files that can lock you out', () => {
    const sshd = describeSystemRisk('/etc/ssh/sshd_config', true);
    expect(sshd?.severity).toBe('critical');
    expect(sshd?.consequence).toMatch(/lock you out/i);

    const fstab = describeSystemRisk('/etc/fstab', true);
    expect(fstab?.severity).toBe('critical');
    expect(fstab?.consequence).toMatch(/boot/i);
  });

  it('treats routine service config as system rather than critical', () => {
    const nginx = describeSystemRisk('/etc/nginx/sites-available/default', true);
    expect(nginx?.severity).toBe('system');
    expect(nginx?.label).toBe('nginx config');
  });

  it('falls back to a generic system warning inside a flagged tree', () => {
    const risk = describeSystemRisk('/usr/share/applications/foo.desktop', true);
    expect(risk?.severity).toBe('system');
    expect(risk?.label).toBe('System file');
  });

  it('still warns on a known-dangerous path even when the agent did not flag it', () => {
    // Defence in depth: the named paths are dangerous regardless of how the
    // agent classified the tree they resolved into.
    expect(describeSystemRisk('/etc/sudoers', false)?.severity).toBe('critical');
  });

  it('normalises Windows separators before matching', () => {
    expect(describeSystemRisk('\\etc\\fstab', true)?.label).toBe('Mount table');
  });

  it('does not match a sibling path that merely shares a prefix', () => {
    // /etc/hostname is critical; /etc/hostnamed.conf is not the same file.
    expect(describeSystemRisk('/etc/hostnamed.conf', true)?.label).toBe('System file');
  });
});

describe('iconForFile', () => {
  it('groups config formats under one icon regardless of extension', () => {
    const yaml = iconForFile(entry({ name: 'compose.yaml', extension: 'yaml' }));
    const conf = iconForFile(entry({ name: 'nginx.conf', extension: 'conf' }));
    expect(yaml.Icon).toBe(conf.Icon);
    expect(yaml.label).toBe('Configuration');
  });

  it('recognises extension-less files by name', () => {
    expect(iconForFile(entry({ name: 'Dockerfile' })).label).toBe('Dockerfile');
    expect(iconForFile(entry({ name: 'authorized_keys' })).label).toBe('SSH keys');
  });

  it('matches on the stem so readme.md is still a readme', () => {
    expect(iconForFile(entry({ name: 'README.md', extension: 'md' })).label).toBe('Readme');
  });

  it('shows a lock for anything the agent refuses to serve', () => {
    const blocked = iconForFile(entry({ name: 'shadow', readable: false }));
    expect(blocked.label).toBe('Blocked by the agent');
  });

  it('distinguishes directories, git directories and symlinks', () => {
    expect(iconForFile(entry({ name: 'etc', type: 'directory', isDirectory: true })).label).toBe('Directory');
    expect(iconForFile(entry({ name: '.git', type: 'directory', isDirectory: true })).label).toBe('Git directory');
    expect(iconForFile(entry({ name: 'link', type: 'symlink' })).label).toBe('Symbolic link');
  });

  it('falls back to a generic file icon for an unknown extension', () => {
    expect(iconForFile(entry({ name: 'data.qqq', extension: 'qqq' })).label).toBe('File');
  });

  it('reads a suffixed dotfile by its leading segment', () => {
    // ".env.production" split naively on "." yields an empty stem and the
    // extension "production", so both lookups miss without special handling.
    expect(iconForFile(entry({ name: '.env.production' })).label).toBe('Environment file');
    expect(iconForFile(entry({ name: '.env' })).label).toBe('Environment file');
    expect(iconForFile(entry({ name: '.dockerignore' })).label).toBe('Docker ignore');
  });

  it('derives the extension when the agent did not report one', () => {
    expect(iconForFile(entry({ name: 'backup.tar.gz' })).label).toBe('Archive');
  });
});
