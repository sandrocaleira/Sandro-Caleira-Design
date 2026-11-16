import type { EngineInterface, Register } from 'claude-code'

// Prompt Master: um botão acima da caixa de prompt (e o comando /prompt-master)
// que pega no pedido que estás a escrever, pergunta o que falta e devolve-o
// reescrito com 6 blocos, de volta à caixa de prompt, pronto a enviar.

const COMMAND = 'prompt-master'
const TOOL = 'aplicar_prompt'

const BLOCOS = `1. Papel — quem o Claude deve ser (especialidade, nível, perspetiva).
2. Objetivo — o resultado final pretendido e para quê/para quem.
3. Contexto — situação, público, dados, ficheiros, o que já existe ou já foi tentado.
4. Tarefa — o que fazer, em passos concretos e por ordem.
5. Restrições — limites, tom, estilo, o que evitar, prazos, ferramentas.
6. Formato e critério de conclusão — como entregar (estrutura, extensão, ficheiro) e como saber que está pronto.`

const metaPrompt = (rascunho: string, ferramenta: string) => `[Prompt Master] Não executes o pedido abaixo. A tua tarefa é apenas melhorá-lo.

Pedido original (rascunho do utilizador):
<rascunho>
${rascunho}
</rascunho>

Framework de 6 blocos:
${BLOCOS}

Passos:
1. Analisa o rascunho bloco a bloco e identifica o que falta ou está ambíguo. Usa o contexto da sessão e do repositório para preencher o que conseguires deduzir com segurança, sem inventar.
2. Se faltar informação que só o utilizador sabe, faz as perguntas numa única chamada à ferramenta AskUserQuestion (no máximo 4 perguntas, só as que mudam o resultado, cada uma com 2 a 4 opções concretas e a recomendada em primeiro lugar). Se nada faltar, salta este passo.
3. Reescreve o pedido em português de Portugal, na voz do utilizador, com os 6 blocos como títulos curtos. Conciso: sem enchimento, sem repetir o óbvio.
4. Chama a ferramenta ${ferramenta} com o prompt final, para o colocar na caixa de prompt do utilizador.
5. Responde só com uma linha a dizer que o prompt melhorado está na caixa, pronto a rever e enviar, e com uma lista curta (máx. 3) do que acrescentaste.`

let ferramenta = `mcp__prompt-master__${TOOL}`

async function melhorar($: EngineInterface, texto?: string) {
  const rascunho = (texto ?? (await $.prompt.read()).text).trim()

  if (!rascunho) {
    $.ui.toast('Prompt Master: escreve primeiro o pedido na caixa de prompt.')

    return false
  }

  if (texto === undefined) {
    await $.prompt.fill({ text: '', mode: 'replace' }).catch(() => undefined)
  }

  await $.prompt.submit({ text: metaPrompt(rascunho, ferramenta) })

  return true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const { tool } = await $.tool.register({
      name: TOOL,
      description:
        'Prompt Master: coloca o prompt final, já melhorado, na caixa de prompt do utilizador (substitui o rascunho), para ele rever e enviar.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'O prompt final, completo, com os 6 blocos.' },
        },
        required: ['prompt'],
      },
      isDeferred: false,
    })
    ferramenta = tool

    await $.command.register({
      name: COMMAND,
      description: 'Melhora o pedido: pergunta o que falta e reescreve-o com 6 blocos',
      argumentHint: '[pedido — vazio usa o rascunho da caixa]',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    try {
      const args = (e.args ?? '').trim()
      const ok = await melhorar($, args || undefined)

      return { text: ok ? 'Prompt Master a analisar o teu pedido…' : 'Sem pedido para melhorar.' }
    } catch (err) {
      return { text: `Prompt Master falhou: ${String(err)}` }
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool !== ferramenta) {
      return next(e)
    }

    const input = e as unknown as { prompt?: unknown }
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''

    if (!prompt) {
      return { deny: 'Falta o campo "prompt" com o texto final.' }
    }

    const isFilled = await $.prompt
      .fill({ text: prompt, mode: 'replace' })
      .then(r => r.isFilled)
      .catch(() => false)

    return {
      result: isFilled
        ? 'Prompt colocado na caixa de prompt do utilizador.'
        : `Não foi possível escrever na caixa de prompt; mostra o prompt final ao utilizador num bloco de código:\n\n${prompt}`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button key="prompt-master" label="✨ Melhorar prompt" onPress={() => void melhorar($).catch(err => $.ui.toast(`Prompt Master falhou: ${String(err)}`))} />
      </Box>
    )
  })
}
