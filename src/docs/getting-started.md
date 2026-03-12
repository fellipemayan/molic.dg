# Começando

## O que é o MoLIC?

**MoLIC** (Modelagem de Ligações Lógicas em Interação com o Computador) é uma notação visual poderosa para especificar e modelar cenários de interação em sistemas computacionais. Diferente de outras abordagens tradicionais, MoLIC oferece uma representação clara das conversações entre usuários e sistemas.

### Principais Características

- **Notação clara e intuitiva** para representar fluxos de interação
- **Suporte para decisões e bifurcações** de fluxo
- **Representação de falas e ações** de usuários e sistema
- **Metadata rica** para documentação e racionalização de decisões
- **Exportação para múltiplos formatos** (SVG, PDF)

## Instalação e Uso

### Como usar o MoLIC.dg

1. **Abra a aplicação** - Você já está aqui! 🎉
2. **Comece a digitar** no bloco de código à esquerda
3. **Veja o diagrama** atualizar em tempo real à direita
4. **Exporte seu trabalho** usando o botão "Export" no topo

### Salvamento Automático

Seu código é salvo automaticamente no navegador. Não se preocupe em perder seu trabalho!

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
