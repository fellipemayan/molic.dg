# Exemplos Práticos 

Aqui você encontrará exemplos completos e prontos para usar em seus próprios projetos. Você pode clicar em "Experimentar" para copiar os códigos para o editor.

## Autenticação Completa

Um fluxo típico de login e registro:

```
start SistemaAutenticacao {
  u: "entrar no app" -> Inicio
}

scene Inicio {
  topic: "Página inicial"
  preferred u: "entrar" -> Login
  u: "criar conta" -> Registro
}

scene Login {
  topic: "Login"

  or {
    subtopic: "Escolher modo de autenticação"
    du: "nome, email, senha" if: "formulário"
    du: "conta Google" if: "entrar com Google"
    du: "conta Github" if: "entrar com GitHub"
  }

  preferred u: "entrar" -> Dashboard
  d: "dados incorretos" if: "" ..> Login
}

scene Registro {
  topic: "Registro de conta"

  or {
    subtopic: "Escolher modo de autenticação"
    du: "nome, email, senha" if: "formulário"
    du: "conta Google" if: "Google"
    du: "conta Github" if: "GitHub"
  }

  u: "criar conta" -> Login
}

main scene Dashboard {}

global Glob {
  u: "sair" -> Fim
}

end Fim 
```

## Carrinho de Compras

Fluxo completo de um e-commerce:

```
start Loja {
  u: "ver itens" -> Catalogo
}

scene Catalogo {
  topic: "Catálogo"

  u: "ver produto" -> DetalhesProduto
}

scene DetalhesProduto {
  topic: "Detalhes do produto"
  
  and {
    subtopic: "Adicionar item ao carrinho"
    u: "quantidade, cor"
    u: "adicionar ao carrinho"
    d: "adicionado ao carrinho" if: "item no estoque"
  }

  d: "item fora de estoque" if: "" -> DetalhesProduto
  u: "ver carrinho" -> Carrinho
}

scene Carrinho {
  topic: "Carrinho"
  let: "total = 349.99"
  let: "qtdItens = 4"

  xor {
    d: "carrinho vazio" if: "qtdItens == 0"
    d: "itens adicionados" if: "qtdItens > 0"
  }

  u: "finalizar compra" -> Endereco
}

scene Endereco {
  topic: "Dados de endereço para entrega"

  or {
    subtopic: "Adicionar endereço"
    du: "endereço salvo" if: "enderecoSalvo"
    du: "CEP, logradouro, número, referência, bairro, cidade, estado"
  }

  d: "endereço inválido" if: "" -> Endereco
  u: "avançar" -> TelaPagamento
}
scene TelaPagamento {
  topic: "Dados de pagamento"

  seq {
    subtopic: "Escolher dados de pagamento"
      du: "escolher(1, lista(boleto, Pix, crédito, débito))" 
      du: "número de parcelas" if: "crédito"
  }

  u: "avançar" -> Pagamento
}

process Pagamento {
  d: "problema no pagamento" ..> TelaPagamento
  d: "pagamento processado" -> Confirmacao
}

scene Confirmacao {
  topic: "Confirmação de pagamento"

  u: "voltar à loja" -> Catalogo
} 
```

## Editor Completo (MoLIC.dg)

Um exemplo real e completo do fluxo de interação do próprio MoLIC.dg com múltiplos diálogos, cenas globais e controle de estado:

```
start ini {
  u: "Entrar" let: "code = localStorage.code"-> EditarMolic
}

main scene EditarMolic {
  topic: "Editar MoLIC"

  and {
    or {
      subtopic: "Mostrar código e diagrama"
        d: "código, diagrama" if: "code"
        d: "código de exemplo, diagrama" if: "!code"

    }
    subtopic: "Editar código"
      u: "escrever código"
      d: "gerar diagrama"
    subtopic: "Editar diagrama"
      d: "diagrama"
    subtopic: "Desfazer ação"
      u: "Desfazer"
        if: "diagram.lastUndos <= 30 ações"
    subtopic: "Refazer ação"
      u: "Refazer"
        if: "diagram.lastRedos > 0"
    subtopic: "Alterar zoom"
      du: "list (aumentar, diminuir, ajustar, valor manual)"
  }

  preferred d: "Parsear código"
    when: "300ms sem digitar" -> AttMolic
}

process AttMolic {
  preferred d: "Atualizar MoLIC"
    if: "código válido"
    effect: "localStorage.code = code"-> EditarMolic
  d: "Erro"
    if: "erro de sintaxe " ..> EditarMolic
}

global G {
  u: "Fechar" -> Fim
  u: "Importar" -> ImportarMolic
  u: "Exportar" -> ExportarMolic
  u: "Mudar tema" -> MudarTema
  u: "Ver docs" -> ViewDocs
}

scene ImportarMolic {
  topic: "Importar Molic"

  and {
    subtopic: "Informar arquivo"
    du: "caminho, nome"
  }

  u: "Confirmar" -> ImportMolic
}

process ImportMolic {
  d: "Arquivo ou caminho inválido"
    if: "" ..> ImportarMolic
  d: "Arquivo carregado"
    if: "Arqivo válido" -> EditarMolic
}

scene ExportarMolic {
  topic: "Exportar Molic"

  and {
    subtopic: "Escolher opção de exportação"
    du: "list (exportar, imprimir)"
    or {
      subtopic: "Escolher formato"
      du: "list (.molic, .svg, .png, .pdf)"
        if: "exportar"
      du: "caminho, nome"
        if: "imprimir"
    }
  }

  u: "Confirmar" -> ExportMolic
}

process ExportMolic {
  d: "Arquivo ou caminho inválido"
    if: "" ..> ExportarMolic
  d: "Arquivo gerado"
    if: "" -> F
}

fork F {
  d: "Arquivo gerado" -> SavedFile
  d: "Abrir janela de impressão"
    if: "imprimir" -> Ext
}

scene MudarTema {
  topic: "Mudar tema"

  and {
    subtopic: "Escolher tema"
    du: "list (claro, escuro, sistema)"
  }

  u: "Escolher" -> ChangeTheme
}

scene ViewDocs {
  topic: "Visualizar documentação"

}

break SavedFile
break ChangeTheme

external Ext

end Fim
```

## Boas Práticas

### Recomendações
- Use nomes de cenas **descritivos** e usando **PascalCase**
- **Documente decisões** com `why`
- **Agrupe falas relacionadas** com `topic`
- **Defina variáveis** que rastreiam estados importantes

### Evite

- Nomes de cenas muito genéricos (`Tela1`, `Passo2`)
- Cenas com lógica excessivamente complexa
- Deixar transições sem contexto
- Ignorar efeitos colaterais importantes
