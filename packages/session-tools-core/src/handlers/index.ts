/**
 * Session Tools Core - Handlers
 *
 * Exports all handler functions for session-scoped tools.
 * These handlers are used by both Claude and Codex implementations.
 */

// SubmitPlan
export { handleSubmitPlan } from './submit-plan.ts';
export type { SubmitPlanArgs } from './submit-plan.ts';

// Config Validate
export { handleConfigValidate } from './config-validate.ts';
export type { ConfigValidateArgs } from './config-validate.ts';

// Skill Validate
export { handleSkillValidate } from './skill-validate.ts';
export type { SkillValidateArgs } from './skill-validate.ts';

// Mermaid Validate
export { handleMermaidValidate } from './mermaid-validate.ts';
export type { MermaidValidateArgs } from './mermaid-validate.ts';

// Source Test
export { handleSourceTest } from './source-test.ts';
export type { SourceTestArgs } from './source-test.ts';

// OAuth Triggers
export {
  handleSourceOAuthTrigger,
  handleGoogleOAuthTrigger,
  handleSlackOAuthTrigger,
  handleMicrosoftOAuthTrigger,
} from './source-oauth.ts';
export type {
  SourceOAuthTriggerArgs,
  GoogleOAuthTriggerArgs,
  SlackOAuthTriggerArgs,
  MicrosoftOAuthTriggerArgs,
} from './source-oauth.ts';

// Credential Prompt
export { handleCredentialPrompt } from './credential-prompt.ts';
export type { CredentialPromptArgs } from './credential-prompt.ts';

// Update Preferences
export { handleUpdatePreferences } from './update-preferences.ts';
export type { UpdatePreferencesArgs } from './update-preferences.ts';

// Transform Data
export { handleTransformData } from './transform-data.ts';
export type { TransformDataArgs } from './transform-data.ts';

// Script Sandbox
export { handleScriptSandbox } from './script-sandbox.ts';
export type { ScriptSandboxArgs } from './script-sandbox.ts';

// Render Template
export { handleRenderTemplate } from './render-template.ts';
export type { RenderTemplateArgs } from './render-template.ts';

// Send Developer Feedback
export { handleSendDeveloperFeedback } from './send-developer-feedback.ts';
export type { SendDeveloperFeedbackArgs } from './send-developer-feedback.ts';

// Session Self-Management
export { handleSetSessionLabels } from './set-session-labels.ts';
export type { SetSessionLabelsArgs } from './set-session-labels.ts';
export { handleSetSessionStatus } from './set-session-status.ts';
export type { SetSessionStatusArgs } from './set-session-status.ts';
export { handleSetSessionAgent } from './set-session-agent.ts';
export type { SetSessionAgentArgs } from './set-session-agent.ts';
export { handleRenameSession } from './rename-session.ts';
export type { RenameSessionArgs } from './rename-session.ts';
export { handleArchiveSession } from './archive-session.ts';
export type { ArchiveSessionArgs } from './archive-session.ts';
export { handlePinSession } from './pin-session.ts';
export type { PinSessionArgs } from './pin-session.ts';
export { handleDeleteSession } from './delete-session.ts';
export type { DeleteSessionArgs } from './delete-session.ts';
export { handleGetSessionInfo } from './get-session-info.ts';
export type { GetSessionInfoArgs } from './get-session-info.ts';
export { handleListSessions } from './list-sessions.ts';
export type { ListSessionsArgs } from './list-sessions.ts';

export { handleSessionsTool } from './sessions-tool.ts';
export type { SessionsToolArgs } from './sessions-tool.ts';
