import { describe, expect, it } from 'vitest';

import { CommandAdapter } from './commandAdapter';
import { emergencyCategories, type EmergencyCommand } from './commands';
import type { SystemInfo } from '../utils/systemDetector';

function system(type: SystemInfo['type']): SystemInfo {
  return {
    type,
    name: type,
    version: '',
    prettyName: type,
    packageManager: 'unknown',
    initSystem: 'unknown',
  };
}

function allCommands(): string[] {
  const commands: string[] = [];
  for (const category of emergencyCategories) {
    for (const item of category.items) {
      if (item.cmd) commands.push(item.cmd);
      if (item.commands) commands.push(...Object.values(item.commands).filter(Boolean));
    }
  }
  return commands;
}

describe('CommandAdapter', () => {
  it('prefers exact system commands, then family fallback, then default', () => {
    const command: EmergencyCommand = {
      id: 'svc',
      name: 'services',
      commands: {
        default: 'service --status-all',
        debian: 'systemctl list-units',
      },
    };

    expect(CommandAdapter.getAdaptedCommand(command, system('debian'))).toBe('systemctl list-units');
    expect(CommandAdapter.getAdaptedCommand(command, system('ubuntu'))).toBe('systemctl list-units');
    expect(CommandAdapter.getAdaptedCommand(command, system('alpine'))).toBe('service --status-all');
  });

  it('keeps emergency command templates portable for minimal systems', () => {
    const commands = allCommands();

    expect(commands.length).toBeGreaterThan(150);
    expect(commands.filter(cmd => cmd.includes('-printf'))).toEqual([]);
    expect(commands.filter(cmd => /(^|[;&|()]\s*)sudo\s+(?!-n\b)/.test(cmd))).toEqual([]);
  });

  it('keeps high-risk templates with core fallbacks', () => {
    const joined = allCommands().join('\n');

    expect(joined).toContain('ss/netstat');
    expect(joined).toContain('rc-status');
    expect(joined).toContain('sudo -n');
  });
});
