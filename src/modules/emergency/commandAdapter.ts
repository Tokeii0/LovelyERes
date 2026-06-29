/**
 * 命令适配器
 * 根据系统类型选择合适的命令
 */

import type { SystemType, SystemInfo } from '../utils/systemDetector';
import type { EmergencyCommand } from './commands';

export class CommandAdapter {
  /**
   * 根据系统类型获取适配后的命令
   */
  static getAdaptedCommand(command: EmergencyCommand, systemInfo: SystemInfo): string {
    // 如果命令有多系统定义
    if (command.commands) {
      // 优先使用系统特定命令
      const systemSpecificCmd = command.commands[systemInfo.type as keyof typeof command.commands];
      if (systemSpecificCmd) {
        return systemSpecificCmd;
      }

      // 尝试使用相似系统的命令（回退机制）
      const fallbackCmd = this.getFallbackCommand(command.commands, systemInfo.type);
      if (fallbackCmd) {
        return fallbackCmd;
      }

      // 使用默认命令
      if (command.commands.default) {
        return command.commands.default;
      }
    }

    // 向后兼容：如果只有 cmd 字段
    if (command.cmd) {
      return command.cmd;
    }

    throw new Error(`命令 ${command.id} 没有可用的命令定义`);
  }

  /**
   * 获取回退命令
   * 根据系统类型的相似性选择合适的回退命令
   */
  private static getFallbackCommand(
    commands: NonNullable<EmergencyCommand['commands']>,
    systemType: SystemType
  ): string | null {
    // 定义系统族群（相似的系统可以共享命令）
    const systemFamilies: Record<string, SystemType[]> = {
      debian: ['ubuntu', 'debian', 'kylin', 'uos', 'deepin'],
      redhat: ['centos', 'rhel', 'fedora', 'openeuler', 'anolis'],
      arch: ['arch'],
      suse: ['opensuse'],
      alpine: ['alpine']
    };

    // 找到当前系统所属的族群
    let currentFamily: SystemType[] = [];
    for (const systems of Object.values(systemFamilies)) {
      if (systems.includes(systemType)) {
        currentFamily = systems;
        break;
      }
    }

    // 在同族群中查找可用命令
    for (const similarSystem of currentFamily) {
      if (similarSystem !== systemType) {
        const cmd = commands[similarSystem as keyof typeof commands];
        if (cmd) {
          return cmd;
        }
      }
    }

    return null;
  }

  /**
   * 批量适配命令
   */
  static adaptCommands(commands: EmergencyCommand[], systemInfo: SystemInfo): Map<string, string> {
    const adaptedCommands = new Map<string, string>();
    
    for (const command of commands) {
      try {
        const adaptedCmd = this.getAdaptedCommand(command, systemInfo);
        adaptedCommands.set(command.id, adaptedCmd);
      } catch (error) {
        console.error(`命令适配失败: ${command.id}`, error);
      }
    }

    return adaptedCommands;
  }

  /**
   * 检查命令是否支持当前系统
   */
  static isCommandSupported(command: EmergencyCommand, systemInfo: SystemInfo): boolean {
    try {
      this.getAdaptedCommand(command, systemInfo);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取命令的系统支持信息
   */
  static getCommandSupportInfo(command: EmergencyCommand): {
    supportedSystems: SystemType[];
    hasDefault: boolean;
  } {
    const supportedSystems: SystemType[] = [];
    let hasDefault = false;

    if (command.commands) {
      if (command.commands.default) {
        hasDefault = true;
      }

      // 检查所有系统特定命令
      const systemTypes: SystemType[] = [
        'ubuntu', 'debian', 'centos', 'rhel', 'fedora',
        'kylin', 'uos', 'deepin', 'openeuler', 'anolis',
        'arch', 'opensuse', 'alpine'
      ];

      for (const systemType of systemTypes) {
        if (command.commands[systemType as keyof typeof command.commands]) {
          supportedSystems.push(systemType);
        }
      }
    }

    return { supportedSystems, hasDefault };
  }
}
