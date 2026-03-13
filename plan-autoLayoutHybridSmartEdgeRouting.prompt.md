## Plan: Auto-layout híbrido + roteamento inteligente de arestas

Implementar auto-layout incremental com grid de 16px para nós e adicionar roteamento inteligente de arestas no transformer, escolhendo handles por custo balanceado (proximidade + penalidade de crossing/overlap), com botão de Auto-layout na toolbar e preservação de edição manual.

**Steps**
1. Fase 1 — Base do layout no transformer
2. Refatorar src/core/transformer.tsx em módulos internos: construção do grafo, classificação semântica, cálculo de posição, seleção de handles e montagem final de nodes/edges.
3. Introduzir utilitários snap16/snapPoint para garantir coordenadas em múltiplos de 16.
4. Definir bounding boxes lógicas por tipo de nó para uso no cálculo de colisão (sem mexer no CSS).
5. Fase 2 — Posicionamento automático dos nós
6. Aplicar lanes verticais por prioridade: topo (start/global/contact), meio (scene/process/fork), fundo (end/external/break), com flexibilização local para evitar colisão severa.
7. Calcular profundidade topológica; nós em cadeia seguem progressão vertical e nós paralelos (mesmo predecessor + mesma profundidade) são distribuídos lado a lado.
8. Aplicar regra de fork: fork abaixo do process origem e targets de fork preferencialmente abaixo dele (incluindo external), com distribuição lateral por ordem.
9. Resolver colisões de nós com deslocamento incremental em grid de 16 e fallback determinístico para lanes adjacentes.
10. Fase 3 — Roteamento inteligente de arestas (novo)
11. Construir catálogo de handles candidatos por nó com coordenadas absolutas previstas (t-*, b-*, l-*, r-*), respeitando tipos especiais (fork com t-1/b-2/b-3).
12. Para cada aresta elegível, avaliar pares sourceHandle-targetHandle por função de custo balanceada:
13. Distância: minimizar Manhattan entre handles.
14. Penalidade de direção: preferir saída/entrada coerente com posição relativa dos nós.
15. Penalidade de overlap com nós: descartar ou penalizar caminhos smooth-step que atravessem bounding boxes de nós não envolvidos.
16. Penalidade de crossing simples: penalizar interseção com segmentos já aceitos quando possível.
17. Selecionar par de menor custo válido e registrar ocupação de handles (limite por handle para evitar aglomeração visual).
18. Anti-overlap intermediário: prioridade em evitar sobreposição com nós e reduzir cruzamentos óbvios, sem busca global cara.
19. Escopo de recálculo de handles no auto-layout: apenas arestas de nós novos (conforme decisão), preservando handles de arestas já estabelecidas.
20. Fase 4 — Estratégia híbrida de persistência
21. Reusar src/hooks/useLayoutPersistence.ts para distinguir nós já posicionados e nós novos.
22. Heurística híbrida: sem layout válido => auto-layout completo; com layout válido => posicionar incrementalmente novos nós e recalcular apenas arestas relacionadas a eles.
23. Persistir preferência de modo (híbrido/preservar/resetar) em localStorage com padrão híbrido.
24. Fase 5 — Botão Auto-layout na toolbar
25. Estender src/components/Diagram/DiagramToolbar.tsx com onAutoLayout e estado isAutoLayouting.
26. Incluir botão Auto-layout na toolbar com tooltip e estado disabled/loading consistente com o visual atual.
27. Em src/components/Diagram/Diagram.tsx, implementar callback do botão para recalcular layout conforme modo ativo, reaplicar handles salvos elegíveis e atualizar nodes/edges.
28. Fase 6 — Estabilidade e validação
29. Garantir compatibilidade com Undo/Redo e reconexão de edges.
30. Adicionar guardrails para target inexistente, ciclo e saturação de handles com fallback previsível.
31. Opcional configurável: fitView após auto-layout para feedback visual imediato.

**Relevant files**
- d:/Documents/Projetos 2026/molic.dg/src/core/transformer.tsx — Auto-layout de nós, scoring de handles e roteamento de arestas.
- d:/Documents/Projetos 2026/molic.dg/src/components/Diagram/MolicEdge.tsx — Referência da geometria smooth-step usada no cálculo de custo.
- d:/Documents/Projetos 2026/molic.dg/src/components/Diagram/Diagram.tsx — Callback do botão e integração com parse/persistência.
- d:/Documents/Projetos 2026/molic.dg/src/components/Diagram/DiagramToolbar.tsx — Botão Auto-layout e props.
- d:/Documents/Projetos 2026/molic.dg/src/components/Diagram/DiagramToolbar.css — Estilo do botão e estado visual.
- d:/Documents/Projetos 2026/molic.dg/src/hooks/useLayoutPersistence.ts — Persistência de posições e handles.
- d:/Documents/Projetos 2026/molic.dg/src/components/Diagram/MolicNode.tsx — Mapeamento real de handles por tipo.

**Verification**
1. Confirmar que x e y finais dos nós obedecem grid de 16.
2. Validar topo/fundo e empilhamento/paralelismo conforme regras.
3. Validar fork abaixo do process e external abaixo do fork quando ligados.
4. Validar seleção de handles por proximidade com função balanceada, reduzindo caminhos contraintuitivos.
5. Validar anti-overlap intermediário: evitar atravessar nós e reduzir cruzamentos simples vs baseline atual.
6. Validar que arestas antigas mantêm handles quando o recálculo for apenas de nós novos.
7. Acionar botão Auto-layout e confirmar atualização correta de nós/arestas + persistência.
8. Validar Undo/Redo e reconexão após auto-layout.
9. Rodar lint/build e checar regressão visual no cenário de molig_dg.molic.

**Decisions**
- Critério de escolha de handles: balanceado (distância + penalidades de overlap/crossing).
- Recálculo de handles no auto-layout: apenas arestas de nós novos.
- Nível anti-overlap: intermediário (sem otimização global cara).
- Modo padrão de layout: híbrido.
- Escopo inclui botão Auto-layout na toolbar.

**Further Considerations**
1. Definir pesos iniciais da função de custo (distância, overlap, crossing, direção) e expor em constantes para tuning.
2. Definir limite por handle (ex.: max 2 conexões) para reduzir aglomeração visual em nós altamente conectados.
3. Prever modo debug opcional para inspecionar score dos pares de handles durante ajustes finos.