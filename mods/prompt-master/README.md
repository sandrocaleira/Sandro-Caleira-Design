# Prompt Master

Mod do Claude Code, feito segundo o guia "O prompt do botão Prompt Master" (VibeHub Academy).
Acrescenta o botão **✦ Prompt Master** na faixa por cima da caixa de prompt e o comando
`/prompt-master [pedido]` (para onde a faixa não aparece, como no VS Code).

## Como funciona (2 chamadas ao modelo por clique)
1. **Ler** — lê o rascunho da caixa. Caixa vazia: mostra um aviso e não gasta nada.
2. **Perguntar** — 1.ª chamada (sonnet, 800 tokens) verifica os 6 blocos e faz no máximo
   3 perguntas, cada uma com 2–3 respostas prováveis + "Pode decidir por mim".
3. **Reescrever** — 2.ª chamada (sonnet, 2000 tokens) monta o pedido nos 6 blocos, sem inventar
   dados (onde falta, escreve `[preencher: ...]`), e põe-no na caixa **sem enviar**.

Depois aparece **↺ Voltar ao original**, que repõe o rascunho; desaparece quando envias um prompt.

## Os 6 blocos
Papel · Tarefa · Contexto · Formato · Restrições · Pronto quando

## Usar em todas as sessões (no teu computador)
```
mkdir -p ~/.claude/skills && cp -R mods/prompt-master ~/.claude/skills/
```
Abre uma sessão nova: aparece como `prompt-master@skills-dir`. Desligar:
`claude plugin disable prompt-master@skills-dir`. Requer Claude Code ≥ 2.1.287 (terminal)
ou ≥ 2.1.286 (app desktop), numa sessão local.
