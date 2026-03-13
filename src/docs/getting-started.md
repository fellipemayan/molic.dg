# Começando

## O que é o MoLIC?

**MoLIC** (Modeling Language for Interaction as Conversation, ou Linguagem para a Modelagem da Interação como uma Conversa) é uma notação da interação como um conjunto de conversas que usuários travam com um sistema para atingir seus objetivos. Além de ferramenta de notação, a MoLIC é uma *ferramenta epistêmica*, ou seja, que funciona para que designers obtenham uma maior compreensão sobre o artefato a ser desenvolvido.

Concebida por Maria Greco de Paula, Bruno Santana da Silva e Simone Diniz Junqueira Barbosa, a MoLIC é um método da Engenharia Semiótica. Expressa na forma de um diagrama, a MoLIC representa cenários e modelos de tarefa, aproximando os objetivos dos usuários com o projeto de interface. 

## MoLIC.dg
O **MoLIC.dg** é uma ferramenta para criação de diagramas MoLIC por meio de código de linguagem própria, baseada na versão 4 do método, proposta na dissertação de [Caroline Loppi Guimarães](https://bdtd.ibict.br/vufind/Record/PUC_RIO-1_799e34e4185a6fd3745ca7aaca3b7702).

O fluxo de funcionamento segue três etapas principais:

1. **A Linguagem (DSL)**: Você escreve o fluxo interativo usando a sintaxe MoLIC no painel de edição. 
2. **Análise Léxica e Sintática (Parsing)**: Assim que você pausa a digitação, o parser lê o seu texto, valida as regras da gramática e o transforma em uma Árvore de Sintaxe Abstrata (AST).
3. **Renderização Visual**: A AST é então convertida dinamicamente em nós e arestas. O diagrama é desenhado na tela com layout automático, permitindo zoom, navegação e a visualização clara de todos os caminhos conversacionais.

### Principais funcionalidades  
- **Live preview inteligente**: O diagrama é atualizado em tempo real enquanto você digita, otimizado para não travar a sua tela durante a formulação das expressões.
- **Componentes ricos**: Suporte visual nativo para todos os elementos da MoLIC V4, incluindo terminais de início/fim, cenas com tópicos, contextos globais, forks, processos de sistema e agentes externos.
- **Arestas semânticas**: As falas (utterances) não são apenas setas; elas carregam metadados valiosos como condições (`if`), gatilhos (`when`), justificativas de design (`why`) e efeitos sistêmicos (`effect`), todos renderizados diretamente na interface.
- **Salvamento automático**: O seu código é salvo automaticamente no navegador. Não se preocupe em perder seu trabalho!
- **Exportação/Importação de diagrama**: 

## Seu Primeiro Diagrama

Vamos criar um exemplo simples de um usuário fazendo login:

```
start Splash {
  u: "entrar" -> Login
}

scene Login {
  topic: "Login"

  and {
    u: "e-mail, senha"
  }

  u: "continuar" -> Auth
}

process Auth {
  d: "credenciais corretas" -> Home
  d: "e-mail ou senha incorretos"
    if: ""
    ..> Login
}

main scene Home {
  topic: "Início"
}
```

> [!info] Dica: Digite `stsc` para um atalho de criação de ponto de início e uma cena inicial.

## Próximos Passos

- Aprenda sobre a **sintaxe completa** em "Sintaxe & Conceitos"
- Explore os **tipos de nós** em "Referência de API"
- Veja **exemplos prontos** em "Exemplos Práticos"
