/**
 * PrerequisiteManager - Prerequisite Reading System
 *
 * Blocks tool calls until specified files have been read in the current context window.
 * State resets on compaction since the LLM loses the guide content.
 *
 * Key responsibilities:
 * - Track which files have been read via the Read tool
 * - Check prerequisites before tool execution (e.g., guide.md for sources)
 * - Reset state on context compaction
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { expandPath } from './path-processor.ts';
import { getBrowserToolEnabled } from '../../config/storage.ts';

// ============================================================
// Types
// ============================================================

export interface PrerequisiteRule {
  /** Match tool names that require prerequisites */
  toolMatcher: (toolName: string) => boolean;
  /** Resolve the required file path for a matched tool. Returns null to skip. */
  resolveRequiredPath: (toolName: string, workspaceRootPath: string) => string | null;
  /** Block message template. {filePath} is replaced with the required path. */
  blockMessage: string;
  /** If true, always block until file is read (no graceful fallback). */
  strict?: boolean;
}

export interface PrerequisiteCheckResult {
  allowed: boolean;
  blockReason?: string;
}

export interface PrerequisiteManagerConfig {
  workspaceRootPath: string;
  onDebug?: (message: string) => void;
}

// ============================================================
// Constants
// ============================================================

/** Slugs that are exempt from prerequisite checks (internal sources) */
const EXEMPT_SLUGS = new Set(['session', 'craft-agents-docs']);

/** Global browser tools docs path required before browser tool usage. */
const BROWSER_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'browser-tools.md'));

/** Global right dock tools docs path required before right dock usage. */
const RIGHT_DOCK_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'right-dock-tools.md'));

/** Global agents tools docs path required before workspace agent management. */
const AGENTS_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'agents-tools.md'));

/** Global automations tools docs path required before workspace automation management. */
const AUTOMATIONS_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'automations-tools.md'));

/** Global resources tools docs path required before workspace resource management. */
const RESOURCES_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'resources-tools.md'));

/** Global session tools docs path required before mutating session management. */
const SESSION_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'session-tools.md'));

/** Global memory tools docs path required before persistent memory management. */
const MEMORY_TOOLS_DOC_PATH = resolve(join(homedir(), '.craft-agent', 'docs', 'memory-tools.md'));

function isBrowserToolPrerequisiteEnabled(): boolean {
  try {
    return getBrowserToolEnabled();
  } catch {
    return true;
  }
}

// ============================================================
// Rules
// ============================================================

/**
 * Static prerequisite rules. Each rule defines:
 * - Which tools it applies to
 * - What file must be read first
 * - What message to show when blocking
 */
const RULES: PrerequisiteRule[] = [
  // MCP source tools: mcp__{slug}__* format
  {
    toolMatcher: (toolName: string) => {
      if (!toolName.startsWith('mcp__')) return false;
      const parts = toolName.split('__');
      if (parts.length < 3) return false;
      const slug = parts[1]!;
      return !EXEMPT_SLUGS.has(slug);
    },
    resolveRequiredPath: (toolName: string, workspaceRootPath: string) => {
      const parts = toolName.split('__');
      const slug = parts[1]!;
      const guidePath = resolve(workspaceRootPath, 'sources', slug, 'guide.md');
      return existsSync(guidePath) ? guidePath : null;
    },
    blockMessage:
      'You must read the source guide before using this tool. Please read the file at {filePath} first, then retry.',
  },

  // API source tools: api_{slug} format
  {
    toolMatcher: (toolName: string) => {
      return toolName.startsWith('api_');
    },
    resolveRequiredPath: (toolName: string, workspaceRootPath: string) => {
      const slug = toolName.slice(4); // Remove 'api_' prefix
      const guidePath = resolve(workspaceRootPath, 'sources', slug, 'guide.md');
      return existsSync(guidePath) ? guidePath : null;
    },
    blockMessage:
      'You must read the source guide before using this tool. Please read the file at {filePath} first, then retry.',
  },

  // Built-in automations tool: require automations-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'automations' || toolName === 'mcp__session__automations',
    resolveRequiredPath: () => {
      return existsSync(AUTOMATIONS_TOOLS_DOC_PATH) ? AUTOMATIONS_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the automations tools guide before managing workspace automations. Please read the file at {filePath} first, then retry.',
    strict: true,
  },

  // Built-in resources tool: require resources-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'resources' || toolName === 'mcp__session__resources',
    resolveRequiredPath: () => {
      return existsSync(RESOURCES_TOOLS_DOC_PATH) ? RESOURCES_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the resources tools guide before managing workspace resources. Please read the file at {filePath} first, then retry.',
    strict: true,
  },

  // Built-in agents tool: require agents-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'agents' || toolName === 'mcp__session__agents',
    resolveRequiredPath: () => {
      return existsSync(AGENTS_TOOLS_DOC_PATH) ? AGENTS_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the agents tools guide before managing workspace agents. Please read the file at {filePath} first, then retry.',
    strict: true,
  },


  // Built-in sessions domain tool: require session-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'sessions' || toolName === 'mcp__session__sessions',
    resolveRequiredPath: () => {
      return existsSync(SESSION_TOOLS_DOC_PATH) ? SESSION_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the session tools guide before managing sessions. Please read the file at {filePath} first, then retry.',
    strict: true,
  },

  // Built-in session mutation tools: require session-tools.md first.
  {
    toolMatcher: (toolName: string) => {
      const names = new Set([
        'set_session_agent',
        'rename_session',
        'archive_session',
        'pin_session',
        'delete_session',
        'mcp__session__set_session_agent',
        'mcp__session__rename_session',
        'mcp__session__archive_session',
        'mcp__session__pin_session',
        'mcp__session__delete_session',
      ]);
      return names.has(toolName);
    },
    resolveRequiredPath: () => {
      return existsSync(SESSION_TOOLS_DOC_PATH) ? SESSION_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the session tools guide before managing sessions. Please read the file at {filePath} first, then retry.',
    strict: true,
  },

  // Built-in memory tool: require memory-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'memory' || toolName === 'mcp__session__memory',
    resolveRequiredPath: () => {
      return existsSync(MEMORY_TOOLS_DOC_PATH) ? MEMORY_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the memory tools guide before managing persistent memory. Please read the file at {filePath} first, then retry.',
    strict: true,
  },
  // Built-in right dock tool: require right-dock-tools.md first.
  {
    toolMatcher: (toolName: string) =>
      toolName === 'right_dock' || toolName === 'mcp__session__right_dock',
    resolveRequiredPath: () => {
      return existsSync(RIGHT_DOCK_TOOLS_DOC_PATH) ? RIGHT_DOCK_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the right dock tools guide before controlling the right dock. Please read the file at {filePath} first, then retry.',
    strict: true,
  },

  // Built-in browser tool: require browser-tools.md first.
  // Only matches the session-scoped tool (not external MCP browser tools like mcp__playwright__*),
  // and skipped entirely when the built-in browser tool is disabled.
  {
    toolMatcher: (toolName: string) =>
      (toolName === 'browser_tool' || toolName === 'mcp__session__browser_tool') &&
      isBrowserToolPrerequisiteEnabled(),
    resolveRequiredPath: () => {
      return existsSync(BROWSER_TOOLS_DOC_PATH) ? BROWSER_TOOLS_DOC_PATH : null;
    },
    blockMessage:
      'You must read the browser tools guide before using browser automation. Please read the file at {filePath} first, then retry.',
    strict: true,
  },
];

// ============================================================
// PrerequisiteManager
// ============================================================

export class PrerequisiteManager {
  /** Max times to block a tool for the same prerequisite before allowing through */
  private static readonly MAX_REJECTIONS = 1;

  private readFiles: Set<string> = new Set();
  private rejectionCounts: Map<string, number> = new Map();
  private pendingSkillPaths: Set<string> = new Set();
  private workspaceRootPath: string;
  private onDebug?: (message: string) => void;

  constructor(config: PrerequisiteManagerConfig) {
    this.workspaceRootPath = config.workspaceRootPath;
    this.onDebug = config.onDebug;
  }

  /**
   * Register skill SKILL.md paths as prerequisites.
   * All tool calls (except Read targeting these paths) are blocked
   * until the files have been read.
   */
  registerSkillPrerequisites(paths: string[]): void {
    for (const path of paths) {
      const expanded = expandPath(path);
      this.pendingSkillPaths.add(expanded);
      this.onDebug?.(`Prerequisite: registered skill prerequisite ${expanded}`);
    }
  }

  /**
   * Check if a tool call's prerequisites are met.
   * Iterates rules, checks if required files have been read.
   * After MAX_REJECTIONS blocks for the same path, allows through gracefully.
   */
  checkPrerequisites(toolName: string): PrerequisiteCheckResult {
    // Check dynamic skill prerequisites first
    const skillResult = this.checkSkillPrerequisites(toolName);
    if (!skillResult.allowed) return skillResult;

    for (const rule of RULES) {
      if (!rule.toolMatcher(toolName)) continue;

      const requiredPath = rule.resolveRequiredPath(toolName, this.workspaceRootPath);
      if (!requiredPath) continue; // No guide.md exists, skip

      if (!this.readFiles.has(requiredPath)) {
        const count = (this.rejectionCounts.get(requiredPath) ?? 0) + 1;
        this.rejectionCounts.set(requiredPath, count);

        const blockReason = rule.blockMessage.replace('{filePath}', requiredPath);

        if (rule.strict) {
          this.onDebug?.(`Prerequisite blocked (strict): ${toolName} requires ${requiredPath}`);
          return { allowed: false, blockReason };
        }

        if (count <= PrerequisiteManager.MAX_REJECTIONS) {
          this.onDebug?.(`Prerequisite blocked (${count}/${PrerequisiteManager.MAX_REJECTIONS}): ${toolName} requires ${requiredPath}`);
          return { allowed: false, blockReason };
        }
        // Exceeded max rejections — allow through gracefully
        this.onDebug?.(`Prerequisite: allowing ${toolName} after ${count} rejections (max reached)`);
      }
    }

    return { allowed: true };
  }

  /**
   * Check dynamic skill prerequisites.
   * If pending skill paths exist and the tool is NOT a Read targeting one of them, block.
   */
  private checkSkillPrerequisites(toolName: string): PrerequisiteCheckResult {
    if (this.pendingSkillPaths.size === 0) return { allowed: true };

    // Allow Read tool through — trackReadTool will clear the prerequisite
    if (toolName === 'Read') return { allowed: true };

    const pendingList = [...this.pendingSkillPaths].join(', ');
    const key = `skill:${pendingList}`;
    const count = (this.rejectionCounts.get(key) ?? 0) + 1;
    this.rejectionCounts.set(key, count);

    if (count <= PrerequisiteManager.MAX_REJECTIONS) {
      const blockReason = `You must read the skill instruction files before proceeding. Use Read or \`cat\` via Bash to read: ${pendingList}`;
      this.onDebug?.(`Skill prerequisite blocked (${count}/${PrerequisiteManager.MAX_REJECTIONS}): ${toolName} — pending: ${pendingList}`);
      return { allowed: false, blockReason };
    }

    // Exceeded max rejections — allow through and clear
    this.onDebug?.(`Skill prerequisite: allowing ${toolName} after ${count} rejections (max reached)`);
    this.pendingSkillPaths.clear();
    return { allowed: true };
  }

  /**
   * Track a Read tool call. Extracts file_path from tool input,
   * normalizes it, and adds to the read set.
   * Also clears matching pending skill paths.
   */
  trackReadTool(toolInput: Record<string, unknown>): void {
    const filePath = (toolInput.file_path as string) || (toolInput.path as string);
    if (!filePath) return;

    const expanded = expandPath(filePath);
    this.readFiles.add(expanded);

    // Clear matching pending skill path
    if (this.pendingSkillPaths.has(expanded)) {
      this.pendingSkillPaths.delete(expanded);
      this.onDebug?.(`Prerequisite: cleared skill prerequisite ${expanded}`);
    }

    this.onDebug?.(`Prerequisite: tracked read of ${expanded}`);
  }

  /**
   * Check if a Bash command is reading a pending skill file.
   * If it matches, clear the prerequisite and return true.
   * Called from the pre-tool-use pipeline to allow targeted Bash reads through.
   */
  trackBashSkillRead(input: Record<string, unknown>): boolean {
    const command = input.command as string;
    if (!command || this.pendingSkillPaths.size === 0) return false;

    let matched = false;
    for (const path of this.pendingSkillPaths) {
      if (command.includes(path)) {
        this.pendingSkillPaths.delete(path);
        this.readFiles.add(path);
        this.onDebug?.(`Prerequisite: cleared skill prerequisite via Bash: ${path}`);
        matched = true;
      }
    }
    return matched;
  }

  /**
   * Reset read state. Called on context compaction since the LLM
   * loses the guide content and needs to re-read.
   * Also clears pending skill paths (model lost the directive).
   */
  resetReadState(): void {
    const count = this.readFiles.size;
    const skillCount = this.pendingSkillPaths.size;
    this.readFiles.clear();
    this.rejectionCounts.clear();
    this.pendingSkillPaths.clear();
    this.onDebug?.(`Prerequisite: reset read state (cleared ${count} reads, ${skillCount} skill prerequisites)`);
  }

  /**
   * Check if a specific file has been read (for testing).
   */
  hasRead(filePath: string): boolean {
    return this.readFiles.has(expandPath(filePath));
  }
}
