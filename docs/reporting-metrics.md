# Contrato de métricas de treinamento — versão 1

## Períodos

O timezone padrão do profissional é `America/Sao_Paulo`. Semana é o intervalo semiaberto da segunda-feira 00:00 até a próxima segunda-feira 00:00. Mês é o intervalo semiaberto do primeiro dia 00:00 até o primeiro dia do mês seguinte. A aplicação converte esses limites locais para UTC antes de chamar a RPC.

## Planejado histórico

`planned_training_occurrences` é a fonte oficial das ocorrências planejadas. Cada linha aponta para a versão imutável de `workouts.id` vigente quando foi materializada. Alterações do slot tornam ocorrências futuras, ainda não vinculadas, `superseded` e criam fatos novos. Ocorrências passadas não são recalculadas. A migration gera somente o futuro dos planos que já existiam; não inventa o passado.

Uma ocorrência pode futuramente receber `appointment_id` e `training_session_id`. Sessões avulsas continuam válidas sem ocorrência.

## Sessões e séries

- Sessão realizada: `training_sessions.status in ('completed', 'partial')`.
- Série planejada: série original com `set_type = 'working'` no workout congelado da ocorrência. Miniblocos não criam séries adicionais.
- Série realizada: `training_session_sets.status in ('completed', 'assumed_completed', 'partial')` e `is_removed = false`. Séries adicionadas entram no realizado; removidas não entram.
- Planejado muscular usa o músculo `Principal` do exercício prescrito.
- Realizado muscular usa o músculo `Principal` executado quando houve substituição.
- Ausência de músculo aparece como `Unclassified` e nunca é redistribuída silenciosamente.

## Volume load

Regra: `Σ repetições × carga`, somando apenas cargas em quilogramas na V1.

- Convencional exato: `reps × load`.
- Faixa: ponto médio da faixa × carga, qualidade `estimated`.
- Miniblocos/métodos avançados: soma de `reps × load` por bloco; blocos não multiplicam séries.
- Parcial: somente valores/blocos efetivamente registrados.
- `assumed_completed`: usa a prescrição; faixa continua `estimated`.
- `operational_load` nunca representa execução.
- `lb`, `%1RM`, peso corporal ou valores ausentes são `unavailable` até existir conversão segura.

Qualidade, da mais forte para a mais fraca: `measured`, `assumed`, `estimated`, `unavailable`. O resumo retorna a pior qualidade presente no agregado.

## Legado

Sessões anteriores continuam aparecendo no realizado. Se não existir ocorrência histórica, planejado não é reconstruído a partir do slot atual e `planning_quality` retorna `unavailable`.
