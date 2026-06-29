import { invoke } from '@tauri-apps/api/core';

export interface CommandExecutionOptions {
  command: string;
  username?: string;
  cwd?: string;
  timeoutSec?: number;
}

export type CommandResultKind =
  | 'success'
  | 'empty'
  | 'nonZero'
  | 'timeout'
  | 'missingCommand'
  | 'permissionDenied'
  | 'error';

export interface CommandExecutionResult {
  command: string;
  output: string;
  exit_code: number | null;
  timestamp?: string;
  duration_ms: number;
  timed_out: boolean;
  kind: CommandResultKind;
  success: boolean;
  message: string;
}

interface RawCommandExecutionResult {
  command?: string;
  output?: string;
  stdout?: string;
  exit_code?: number | null;
  timestamp?: string;
  duration_ms?: number;
  timed_out?: boolean;
}

export function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function classifyCommandResult(raw: RawCommandExecutionResult, fallbackCommand: string): CommandExecutionResult {
  const output = raw.output ?? raw.stdout ?? '';
  const exitCode = typeof raw.exit_code === 'number' ? raw.exit_code : null;
  const timedOut = raw.timed_out === true;
  const lower = output.toLowerCase();
  const durationMs = typeof raw.duration_ms === 'number' ? raw.duration_ms : 0;

  let kind: CommandResultKind = 'success';
  let success = true;
  let message = '执行完成';

  if (timedOut) {
    kind = 'timeout';
    success = false;
    message = '命令执行超时';
  } else if (
    lower.includes('permission denied') ||
    lower.includes('operation not permitted') ||
    lower.includes('a password is required') ||
    lower.includes('需要密码') ||
    lower.includes('权限不足')
  ) {
    kind = 'permissionDenied';
    success = false;
    message = '权限不足或需要交互式认证';
  } else if (
    lower.includes('command not found') ||
    lower.includes('not installed') ||
    lower.includes('not available') ||
    lower.includes('no such file or directory')
  ) {
    kind = 'missingCommand';
    success = false;
    message = '目标系统缺少命令或文件';
  } else if (exitCode !== null && exitCode !== 0) {
    kind = 'nonZero';
    success = false;
    message = `命令返回非 0 退出码: ${exitCode}`;
  } else if (!output.trim()) {
    kind = 'empty';
    message = '执行成功，无匹配结果';
  }

  return {
    command: raw.command || fallbackCommand,
    output,
    exit_code: exitCode,
    timestamp: raw.timestamp,
    duration_ms: durationMs,
    timed_out: timedOut,
    kind,
    success,
    message,
  };
}

export async function executeEmergencyCommand(options: CommandExecutionOptions): Promise<CommandExecutionResult> {
  const raw = await invoke<RawCommandExecutionResult>('ssh_execute_emergency_command_direct', {
    command: options.command,
    username: options.username,
    cwd: options.cwd,
    timeoutSec: options.timeoutSec,
  });

  return classifyCommandResult(raw, options.command);
}

export function formatCommandResult(result: CommandExecutionResult): string {
  const meta = [
    result.message,
    result.exit_code !== null ? `exit=${result.exit_code}` : '',
    result.duration_ms > 0 ? `${result.duration_ms}ms` : '',
  ].filter(Boolean).join(' · ');

  const body = result.output.trim() || '(无输出)';
  return `[${meta}]\n${body}`;
}
