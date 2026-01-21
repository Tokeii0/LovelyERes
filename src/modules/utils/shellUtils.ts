/**
 * Shell command utilities
 */

/**
 * Wraps a command in `bash -c '...'` for safe execution, especially with sudo.
 * It automatically handles escaping of single quotes within the command.
 * 
 * @param command The shell command to wrap
 * @returns The wrapped command string
 */
export function wrapCommandWithBash(command: string): string {
  if (!command) return '';
  
  const trimmed = command.trim();
  if (trimmed.startsWith('bash -c')) {
    return trimmed;
  }

  // 转义: ' -> '\''
  const escapedCommand = command.replace(/'/g, "'\\''");
  
  // 包含在 bash -c '...'
  return `bash -c '${escapedCommand}'`;
}
