import { describe, expect, it } from 'vitest';

import { classifyCommandResult, quoteShellArg } from './commandExecution';

describe('commandExecution', () => {
  it('quotes shell arguments safely', () => {
    expect(quoteShellArg('/tmp/a b')).toBe("'/tmp/a b'");
    expect(quoteShellArg("a'b")).toBe("'a'\\''b'");
    expect(quoteShellArg('')).toBe("''");
  });

  it('classifies timeout results', () => {
    const result = classifyCommandResult({
      command: 'find /',
      output: '命令执行超时（60 秒）',
      timed_out: true,
      duration_ms: 60000,
    }, 'find /');

    expect(result.kind).toBe('timeout');
    expect(result.success).toBe(false);
  });

  it('classifies missing command and empty successful output', () => {
    expect(classifyCommandResult({
      output: 'ss: command not found',
      exit_code: 127,
    }, 'ss').kind).toBe('missingCommand');

    const empty = classifyCommandResult({ output: '', exit_code: 0 }, 'grep nothing');
    expect(empty.kind).toBe('empty');
    expect(empty.success).toBe(true);
  });
});
