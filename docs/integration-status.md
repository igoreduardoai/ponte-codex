# Situação da validação · Ponte · 28/10/2026

Tudo permanece no projeto local `/Users/louisxiv/ponte`. Nenhum push,
publicação, inscrição ou alteração no Cortexa foi realizado.

## Os quatro itens solicitados

1. **Groq real: executado. Twitch real: pendente.** `npm run test:groq`
   passou com `openai/gpt-oss-20b`: PT→EN, EN→PT e resumo bilíngue.
   Emotes, menção, URL e emoji usados no teste foram preservados.
   Fallback offline é explicitamente rejeitado como sucesso neste teste.
   [Saídas reais](groq-smoke-report.json).
   Twitch não foi autenticado nem conectado: faltam `TWITCH_CLIENT_ID`,
   `TWITCH_BROADCASTER_ID`, `TWITCH_USER_ID` e `.ponte-token.json`.
   O canal autorizado para as mensagens sintéticas não foi informado.
   O [preflight](live-preflight.json) só verifica configuração, sem rede.
2. **OBS: não executado.** Não foi encontrado nas pastas padrão, no
   inventário de aplicativos ou na busca Spotlight por `OBS.app`.
   Nenhuma instalação foi tentada: a instrução do usuário exige revisão
   de procedência e primeira execução em VM descartável para software novo;
   essa validação não foi realizada.
   Corrigi o fundo da raiz HTML e conferi transparência da raiz e do corpo
   no navegador, com seis linhas visíveis. Isso não exercita Browser Source,
   composição, captura ou gravação no OBS.
   [Registro](obs-validation.json) e [captura](overlay-browser-preview.png).
3. **50 exemplos: escritos e executados.** Mensagens sintéticas novas em
   PT e referências EN escritas por Codex antes da primeira avaliação.
   Cada variante completou 50/50 na repetição com espaçamento: 150 traduções
   Groq e 50 offline, sem falhas ou retries. A primeira tentativa teve 114
   HTTP 429 e foi preservada como [incompleta](eval-50-attempt-1.json).
   Somente a segunda execução compara o mesmo conjunto completo.
4. **Session ID real identificado e salvo:**
   `01a1829a-60b5-7f91-b903-27adbd1d91a8`.
   Lido de `CODEX_SESSION_ID` e `CODEX_THREAD_ID`, e conferido com o
   `codexSessionId` do inventário do app. A skill `statusline` foi consultada;
   não foi necessário alterar a configuração global nem usar payload fictício.
   [Evidência](codex-session.json), [método](codex-session.md).

## Resultados medidos nos 50 exemplos

| Variante | Concluídos | chrF | Emotes preservados | Gírias não traduzidas | p50 ms | p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Prompt literal | 50/50 | 63.44 | 100% | 7.89% | 480.78 | 1133.27 |
| Ponte sem glossário | 50/50 | 63.12 | 100% | 2.63% | 525.45 | 1495.18 |
| Ponte completo | 50/50 | 64.66 | 100% | 2.63% | 542.85 | 1282.48 |
| Regras offline | 50/50 | 23.72 | 100% | 78.95% | 0.01 | 0.04 |

[Relatório com todas as saídas](eval-50-report.json) ·
[Exemplos](../data/eval-50.jsonl) · [Método](eval-50-methodology.md).
Os hashes do conjunto, glossário e fonte do tradutor confirmam que nenhum
foi ajustado após observar esses resultados. Só o agendamento da avaliação
mudou para espaçar chamadas e respeitar HTTP 429.

chrF é uma média de scores de frases, não SacreBLEU corpus chrF. Latências
excluem a espera inicial entre pedidos. Os 20 emotes e 28 tokens protegidos
anotados foram preservados nas quatro variantes. Isso não comprova tradução
correta. O conjunto é sintético e seu autor escreveu a implementação;
não é validação independente ou cega. O ganho de 1,22 ponto do completo
sobre o literal não estabelece superioridade geral a partir deste teste.

## Defeitos observados ao conferir as saídas

- `pt-05`: “não abre o baú ainda” perdeu a ordem negativa e virou
  “the chest still won’t open” nas variantes de chat.
- `pt-19`: “valeu cada centavo” virou “thanks for every cent” no completo;
  a tradução do glossário para “valeu” contribuiu para esse erro de sentido.
- `pt-26`: “fui de base” foi interpretado como localização na base em vez
  de ter sido eliminado, nas três variantes Groq.
- `pt-12`: as variantes de chat introduziram palavrão ao traduzir “mds”.
- O detector reconheceu PT em apenas 40/50 exemplos. Outros oito foram
  marcados como desconhecidos e dois como EN. O comparativo fixa PT como
  idioma conhecido: não mede qualidade do pipeline completo. O pipeline
  real deixaria os desconhecidos inalterados e escolheria a direção errada
  para os dois classificados como EN.

O offline é fraco para frases livres. Não corrigi esses casos ajustando o
glossário a este conjunto exposto. Melhoria futura precisa de outro conjunto
de desenvolvimento e validação independente.

## Execução e pendências

`npm test`: **25 testes passaram**, incluindo rejeição de fallback como
sucesso real, duplicatas, emotes repetidos, fragmentos, identidade da sessão,
e espera limitada após HTTP 429. Não foi necessária migração de dados.

Ainda não exercitados: OAuth Twitch real, renovação real, EventSub real,
respostas Helix, moderação real, reconexão real, renderização de emotes CDN,
OBS e live de 15 minutos. Dependem de credenciais/configuração Twitch,
canal autorizado e acesso ao OBS com a validação de instalação exigida.
Os mocks não contam como execução desses itens. Nenhum novo pacote,
imagem ou aplicativo de terceiros foi instalado.
