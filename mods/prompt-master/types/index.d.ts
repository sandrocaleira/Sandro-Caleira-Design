export type Original = string | null

declare module 'claude-code' {
  interface PluginState {
    'prompt-master': { isBusy: boolean; original: Original }
  }
}
