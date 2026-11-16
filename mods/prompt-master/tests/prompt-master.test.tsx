import { expect, test } from 'claude-code/testing'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'prompt-master',
    component: 'AbovePrompt',
    surface,
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10 },
  }) as const

const PERGUNTA = 'Pra quem é o post?'
const FINAL = 'Papel: redator de redes sociais.\nTarefa: 1 post sobre a cafeteria.'

test('o botão lê, pergunta 1 vez e põe o pedido reescrito na caixa, sem enviar', async ($, on) => {
  const calls: { system: string; prompt: string }[] = []
  const filled: string[] = []
  let submitted = 0

  on('ui.toast', () => ({ value: undefined }))
  on('prompt.read', () => ({ value: { text: 'escreve um post sobre minha cafeteria', cursor: 0 } }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: 0 }
  })
  on('prompt.submit', (_, e) => {
    submitted += 1
    return { text: e.text }
  })
  on('model.complete', (_, e) => {
    calls.push({ system: String(e.system ?? ''), prompt: String(e.prompt) })
    const text =
      calls.length === 1
        ? `ok {"perguntas":[{"pergunta":"${PERGUNTA}","opcoes":["Clientes do bairro","Estudantes"]}]}`
        : FINAL
    return { value: { isAnswered: true, text, usage: { input_tokens: 1, output_tokens: 1 } } } as never
  })
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0]!
    return { result: { questions: [q], answers: { [q.question]: 'Clientes do bairro' } } } as never
  })

  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'prompt-master' })

  expect(calls.length).toBe(2)
  expect(calls[0]!.system).toContain('Confira 6 blocos')
  expect(calls[1]!.prompt).toContain('Resposta: Clientes do bairro')
  expect(filled.at(-1)).toBe(FINAL)
  expect(submitted).toBe(0)

  await ui.press({ key: 'prompt-master-voltar' })
  expect(filled.at(-1)).toBe('escreve um post sobre minha cafeteria')
  await ui.unmount()
})

test('caixa vazia mostra aviso e não chama o modelo', async ($, on) => {
  let modelCalls = 0
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(String((e as unknown as { text: string }).text))
    return { value: undefined }
  })
  on('prompt.read', () => ({ value: { text: '   ', cursor: 0 } }))
  on('model.complete', () => {
    modelCalls += 1
    return { value: { isAnswered: false, reason: 'empty-reply', usage: { input_tokens: 0, output_tokens: 0 } } } as never
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'prompt-master' })
    await ui.unmount()
  }

  expect(modelCalls).toBe(0)
  expect(toasts.length).toBe(2)
})
