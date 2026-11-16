import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Prompt Master — segue a especificação do guia "O prompt do botão Prompt Master"
// (VibeHub Academy). Lê o rascunho da caixa, pergunta no máximo 3 coisas que faltam
// e devolve o pedido reescrito em 6 blocos à caixa, sem enviar.

const COMMAND = 'prompt-master'
const MODEL = 'haiku'
const MAX_PERGUNTAS = 3
const DECIDIR = 'Pode decidir por mim'

const isBusy = atom({ plugin: 'prompt-master', key: 'isBusy' } as const, false)
const original = atom({ plugin: 'prompt-master', key: 'original' } as const, null)

// Textos do guia, adaptados para português de Portugal.
const ANALISE = `Lês o rascunho de um pedido que alguém vai enviar ao Claude e decides se falta informação para fazer um bom trabalho.
Verifica 6 blocos: Papel (quem o Claude deve ser), Tarefa (o que entregar), Contexto (para quem é, qual o negócio, o que já existe), Formato (tamanho, estrutura, tom e onde vai ser usado), Restrições (o que evitar, prazo, limite) e Pronto quando (como saber que ficou bom).
Pergunta só o que muda o resultado e que não se consegue deduzir do rascunho nem descobrir lendo os ficheiros do projeto. Uma tarefa clara e pequena não precisa de pergunta.
No máximo 3 perguntas, curtas, cada uma a terminar em ponto de interrogação, com 2 ou 3 respostas prováveis de até 5 palavras cada.
Responde só com JSON, sem texto antes ou depois, neste formato:
{"perguntas":[{"pergunta":"Para quem é a publicação?","opcoes":["Clientes do bairro","Estudantes","Empresas"]}]}
Se não faltar nada, responde {"perguntas":[]}.`

const REESCRITA = `Reescreves o rascunho de uma pessoa num pedido completo para o Claude, usando as respostas dela quando as houver.
Organiza nestes blocos, por esta ordem, cada um a começar pelo nome e dois pontos: Papel, Tarefa, Contexto, Formato, Restrições, Pronto quando. Salta o bloco que não se aplica.
Mantém a intenção e todos os factos do rascunho. Não inventes números, nomes, preços, prazos ou dados: onde faltar algo essencial que a pessoa não respondeu, escreve [preencher: o que falta].
Quando a resposta for "Pode decidir por mim", escolhe a opção mais comum para o caso.
Se o pedido mexe em código ou ficheiros, pede ao Claude que leia os ficheiros do projeto antes de alterar e diz o que verificar no fim.
Escreve na língua do rascunho; se for português, usa português de Portugal (tu, "ecrã", "ficheiro", "telemóvel", "equipa"), nunca português do Brasil. Sê direto, sem saudação e sem "por favor".
Devolve só o pedido reescrito, pronto a enviar, sem aspas, sem título e sem comentários antes ou depois.`

type Pergunta = { pergunta: string; opcoes: string[] }

function lerPerguntas(texto: string): Pergunta[] {
  const inicio = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')

  if (inicio < 0 || fim <= inicio) {
    return []
  }

  try {
    const json = JSON.parse(texto.slice(inicio, fim + 1)) as { perguntas?: unknown }
    const lista = Array.isArray(json.perguntas) ? json.perguntas : []

    return lista
      .map(item => {
        const p = item as { pergunta?: unknown; opcoes?: unknown }
        const opcoes = Array.isArray(p.opcoes)
          ? p.opcoes.filter((o): o is string => typeof o === 'string' && o.trim() !== '').slice(0, 3)
          : []

        return { pergunta: typeof p.pergunta === 'string' ? p.pergunta.trim() : '', opcoes }
      })
      .filter(p => p.pergunta !== '')
      .slice(0, MAX_PERGUNTAS)
  } catch {
    return []
  }
}

async function melhorar($: EngineInterface, texto?: string): Promise<void> {
  if (await read($, isBusy)) {
    return
  }

  const rascunho = (texto ?? (await $.prompt.read()).text).trim()

  if (!rascunho) {
    $.ui.toast('Escreve o pedido na caixa e carrega no botão outra vez.')

    return
  }

  await update($, isBusy, () => true)

  try {
    const analise = await $.model.complete({
      model: MODEL,
      system: ANALISE,
      prompt: rascunho,
      maxTokens: 800,
    })

    if (!analise.isAnswered) {
      $.ui.toast(`Prompt Master: o modelo não respondeu (${analise.reason}).`)

      return
    }

    const respostas: string[] = []

    for (const p of lerPerguntas(analise.text)) {
      try {
        const resposta = await $.ui.ask(p.pergunta, {
          options: [...p.opcoes, DECIDIR],
          header: 'Prompt Master',
        })
        respostas.push(`Pergunta: ${p.pergunta}\nResposta: ${resposta}`)
      } catch {
        // Pergunta fechada sem resposta: segue sem ela.
      }
    }

    const pedido = respostas.length
      ? `RASCUNHO:\n${rascunho}\n\nRESPOSTAS:\n${respostas.join('\n\n')}`
      : `RASCUNHO:\n${rascunho}`

    const reescrita = await $.model.complete({
      model: MODEL,
      system: REESCRITA,
      prompt: pedido,
      maxTokens: 2000,
    })

    if (!reescrita.isAnswered || !reescrita.text.trim()) {
      const motivo = reescrita.isAnswered ? 'resposta vazia' : reescrita.reason
      $.ui.toast(`Prompt Master: o modelo não respondeu (${motivo}).`)

      return
    }

    const { isFilled } = await $.prompt.fill({ text: reescrita.text.trim(), mode: 'replace' })

    if (isFilled) {
      await update($, original, () => rascunho)
    } else {
      $.ui.toast('Prompt Master: não consegui escrever na caixa de prompt.')
    }
  } catch (err) {
    $.ui.toast(`Prompt Master falhou: ${String(err)}`)
  } finally {
    await update($, isBusy, () => false)
  }
}

async function voltarAoOriginal($: EngineInterface): Promise<void> {
  const texto = await read($, original)

  if (texto !== null) {
    await $.prompt.fill({ text: texto, mode: 'replace' })
    await update($, original, () => null)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, isBusy, () => false)
    await $.command.register({
      name: COMMAND,
      description: 'Pergunta o que falta no pedido e reescreve-o em 6 blocos',
      argumentHint: '[pedido — vazio usa o rascunho da caixa]',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, ($, e) => {
    const args = (e.args ?? '').trim()
    void melhorar($, args || undefined).catch(() => undefined)

    return { text: 'Prompt Master a ler o pedido…' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'plugin') {
      await update($, original, () => null).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)
    const busy = await read($, isBusy)
    const temOriginal = (await read($, original)) !== null

    return (
      <Box gap={1}>
        <Button
          key="prompt-master"
          label={busy ? '✦ Prompt Master: a ler...' : '✦ Prompt Master'}
          onPress={() => void melhorar($).catch(() => undefined)}
        />
        {temOriginal && !busy && (
          <Button
            key="prompt-master-voltar"
            label="↺ Voltar ao original"
            onPress={() => void voltarAoOriginal($).catch(() => undefined)}
          />
        )}
      </Box>
    )
  })
}
