import { expect, test } from 'claude-code/testing'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'prompt-master',
    component: 'AbovePrompt',
    surface,
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10 },
  }) as const

test('o botão envia o rascunho ao Prompt Master e a ferramenta devolve-o à caixa', async ($, on) => {
  const submitted: string[] = []
  const filled: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__prompt-master__${e.name}` } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.read', () => ({ value: { text: 'faz um site para a minha loja', cursor: 0 } }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: 0 }
  })
  on('prompt.submit', (_, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    submitted.length = 0
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'prompt-master' })
    expect(submitted.length).toBe(1)
    expect(submitted[0]).toContain('faz um site para a minha loja')
    expect(submitted[0]).toContain('AskUserQuestion')
    await ui.unmount()
  }

  const r = await $.tool.call({ tool: 'mcp__prompt-master__aplicar_prompt', prompt: 'PROMPT FINAL' } as never)
  expect(filled.at(-1)).toBe('PROMPT FINAL')
  expect(JSON.stringify(r)).toContain('caixa')
})
