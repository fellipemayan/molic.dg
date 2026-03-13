# Sintaxe & Conceitos

## Estrutura Básica
Um diagrama MoLIC básico segue uma estrutura simples:

```
start Splash {
  u: "entrar no MoLIC.dg" -> MolicDG
}

scene MolicDG {
  topic: "Editar diagrama"

  and {
    du: "código, diagrama"
  }

  u: "fechar" -> Fim
}

end Fim
```

## Os Blocos Fundamentais

### Ponto de abertura (start)
Representa o ponto de entrada de um aplicativo, que leva à primeira cena. É possível que haja mais de um ponto de abertura quando uma aplicação puder ser iniciada em diferentes estados ou cenas.
```
start Inicio {
  //aqui geralmente entra uma fala de usuário:
  //du: "mensagem" -> Conversa
}
```
> [!info] Dica: Digite `stsc` para criar uma abertura de conversa com uma cena inicial.

### Cena (scene)
Uma cena representa uma conversa que o usuário pode ter com o sistema (preposto do designer).
```
scene EditarDiagrama {
  topic: "Editar diagrama"
}
```
> [!info] Dica: Digite `main` ou `alert` antes de uma cena para declará-la como cena principal ou de alerta.

#### Diálogos e signos
Cada cena pode receber um ou mais diálogos, compostos por um subtópico e signos, que repserentam as partes da conversa que aconteccem por meio da interação com o sistema.
```
scene EditarDiagrama {
  topic: "Editar diagrama"

  //uma diálogo é, por padrão, do tipo "and":
  and { 
    subtopic: "Editar código"
    du: "código"

    subtopic: "Mover nó"
    du: "nó, posição"

    subtopic: "Mover aresta"
    du: "aresta, vértice, nó, handle de destino"
  }
}
```

#### Operadores de agrupamento de diálogos
Cada cena pode ter um ou mais grupos de diálogos. Os tipos de operadores são:
- **and**: todos os diálogos do grupo devem acontecer. Esta é a estrutura padrão.
- **seq**: todos os diálogos do grupo devem acontecer *em uma ordem específica*.
- **or**: alguns dos diálogos podem ser opcionais.
- **xor**: apenas um dos diálogos podem ocorrer.
```
scene SalvarDiagrama {
  topic: "Exportar diagrama"

  xor {
    and {
      subtopic: "Salvar como .molic"

      du: "local, nome"
    }

    and {
    subtopic: "Imprimir diagrama"

    u: "imprimir"
    }

    seq {
      subtopic: "Salvar como imagem"
      let: "formato = null"
      or {
        subtopic: "Escolher formato de arquivo"
        u: ".pdf"
        u: ".png (fundo branco)"
        u: ".png (fundo transparente)"
        u: ".molic"
      }
      du: "{formato}, local, nome"
    }
  }
}
```
> [!info] **Dica**: grupos de diálogos podem ser aninhados entre si.

### Processamento do sistema (proc)
Representam o processamento do aplicativo no momento em que ele recebe um pedido do usuário: 
```
scene EditarArquivo {
  topic: "Editar Arquivo"
  
  and {
    subtopic: "Editar texto"
    du: "texto novo"
  }
  
  u: "Subir arquivo" -> SubirArquivo
}

process SubirArquivo {
  d: "aquivo válido" -> EditarArquivo
  d: "formato incompatvel" 
    if: "" // quando a mensagem é a mesma da condição, pode-se omitir a mensagem do if
    ..> EditarArquivo
}
```

### Mudança global de tópico (global)
Anteriormente conhecida como _Acesso Ubíquo_, representa uma mudança de assunto que pode ocorrer a qualquer momento durante a interação:
```
global Global {
  u: "salvar arquivo" ->  SalvarArquivo
}

scene SalvarArquivo {
  topic: "Salvar arquivo"
  // ...
}
```

### Conclusão da conversa sobre um tópico (break) 
Representa o encerramento de um tópico específico em que não há mais o que o usuário faça para atingir certo objetivo.
```
scene PagContato {
  topic: "Contato"

  and {
    subtopic: "Enviar e-mail"
    du: "nome, e-mail, mensagem"
  }

  u: "enviar" if: "dados obrigatórios preenchidos" -> EnviarEmail
}

break EnviarEmail
```

### Ponto de encerramento (end)
Representa um ponto de saída de um aplicativo.
```
end Fim
```

## Elementos de transição
As falas representam as mensagens ou ações trocadas entre usuário e sistema (designer). Elas podem ocorrer entre duas cenas, uma cena e um processo de sistema, ou dois processos de sistema.

> [!warning] **Atenção**: apesar de sermem declaradas de forma similar, falas de transição são diferentes de diálogos de cenas.

### Falas do designer
Use `d: "[mensagem]"` para mensagens do designer/sistema.

#### Fala de transição do designer
Representa a comunicação do designer a respeito do resultado de um processo do sistema. Declarada por indicador de transição (`->`).

#### Fala de recuperação do designer
Representa a comunicação do designer a respeito de um resultado inesperado de um processo do sistema ou uma ruptura comunicativa. Declarada por indicador de recuperação (`..>`).
```
process Auth {
  d: "dados válidos" -> Inicio //Fala do designer
  d: "dados inválidos" ..> Login //Fala de recuperação do designer
}
```

#### Troca de turno silenciosa
Representa um caso em que não há a necessidade de uma fala explícita do designer.
```
process VerificarArquivo {
  d: "" if: "nome e arquivo válidos" -> "SaveSuccess"
}

break SaveSuccess
```

### Falas do usuário
Use `u: "[mensagem]"` para mensagens do usuário/sistema.

#### Fala de transição do usuário
Representa uma tentativa do usuário de avançar ou mudar um tópico. Declarada por indicador de transição (`->`).

#### Fala de recuperação do usuário
Representa a tentativa do usuário de recuperar desistir de uma conversa. Declarada por indicador de recuperação (`..>`).

```
scene Checkout {
  topic: "Finalizar compra"

  //and {...}

  u: "confirmar" -> ProcessarPagamento //Fala de transição do usuário
  u: "cancelar" ..> Carrinho // Fala de recuperação do usuário
}
```

## Elementos adicionais
Os elementos a seguir são usados para modificar ou adicionar contextos, condições e gatilhos às cenas e falas. Eles podem ser adicionados:
- Em uma fala de transição;
- Em uma fala de recuperação;
- Em um diálogo (*if*, *effect* e *let* apenas); ou
- Em um agrupador de diálogos (*if* apenas).

### Se (if)
Esse elemento é usado para criar uma condição que deve ser atingida para que a conversa continue. 
```
scene Carrinho {
  topic: "Revisar pedido"

  // if em agrupador de diálogo
  and if: "carrinho não está vazio" { 

    // if em signo
    d: "você ganhou frete grátis!" 
      if: "valor_total >= R$100" 
  }
  
  u: "fazer pagamento" 
    //if em fala de transição
    if: "itens disponíveis" -> Checkout 
}

process Checkout {
  //if em fala de reuperação
  d: "Saldo insuficiente" 
    if: "" ..> Carrinho 
} 

```
### Definição (let)
Representa uma declaração explícita de um valor inicial em um contexto.
```
start Comeco {
  let: "userTheme = localSotrage(userTheme)"
  u: "abrir app" effect: "{prefers-color-scheme: userTheme}" -> Dashboard
}

scene Dashboard {
  topic: "Dashboard"
  //...
}
```

### Efeito (effect)
Representa uma consequência que afeta o futuro da conversa.
```
scene Vitrine {
  topic: "Lista de produtos"
}

scene Checkout {
  topic: "Finalização da Compra"
  let: "valor = {somaPreco(itens[].preco)}"

  u: "confirmar" effect: "{fazerPagamento(valor)}" -> Processando
  u: "cancelar" ..> Vitrine
}

process Processando {
  d: "Comunicar com a API do Banco" effect: "{gerar_NF()}" -> Sucesso
  
  d: "Falha na transação" if: "cartão recusado" effect: "registrarLog(erro)" ..> Checkout
}

break Sucesso 
```

### Quando (when)
Esse elemento é usado para definir gatilhos que podem interromper uma fala do usuário e redirecionar a conversa para outra cena.
```
scene TelaLogin {}

scene AreaLogada {
  topic: "Conta corrente"

  d: "acesso expirado" when: "15 minutos de inatividade" -> TelaLogin
}
```

### Porquê (why)
Esse é um elemento de anotação que pode ser adicionado em cenas, diálogos e falas.
```
scene CadastroSensivel {
  topic: "Coleta de Dados"

  // Justificando uma pergunta do sistema
  why: "Restrição legal: o serviço é estritamente para maiores de 18 anos e exige auditoria."
  
  and {
    u: "data de nascimento"
  }
    // Justificando uma ruptura imposta ao usuário
    d: "" -> Conta
    d: "você não tem idade mínima para prosseguir." if: "idade < 18" why: "Conformidade com os Termos de Uso e bloqueio de responsabilidade legal." ..> Fim
}

scene Conta {}

scene ExclusaoDeConta {
  topic: "Zona de Perigo"
  
  // Justificando o esforço cognitivo exigido do usuário
  du: "'QUERO APAGAR MINHA CONTA'." 
  why: "Adiciona atrito proposital para prevenir exclusões acidentais ou por bots."
  
  u: "frase" if: "Digita a frase correta" -> ProcessoDeExclusao
}

scene ProcessoDeExclusao {}

end Fim
```

## MoLIC avançada

### Bifurcação (fork) e Interlocutor externo (external)
Representa o caso em que uma conversa leva a outro sistema. Para isso, são usados os elementos de bifurcação e interlocutor externo após um processamento de sistema: 
```
scene Inicio {
  
}

process EnviarCodigo {
  d: "e-mail de confirmação" -> Bif
}

fork Bif {
  d: "" -> Inicio
  d: "Verifique o códigoo no seu e-mail" -> AppDeEmail

}

external AppDeEmail
```
> [!info] Dica: Digite `procfork` para criar um proceso de sistema que encaminha para uma cena do sistema e um agente externo.

### Ponto de contato (contact)
Idealmente, quando há papéis de usuário muito diferentes, é feita uma MoLIC para cada um deles. No entanto, em casos em que os papéis são muito similares e um dos papéis de usuário influencia a interação de outros, usa-se o ponto de contato. 
```
scene EditarDoc {
  topic: "Editar Documento"
  
}

scene ComentarDoc {
  topic: "Comentar Documento"
  
}
contact Editor {
  role: "Editor"
  : "Editar" -> EditarDoc
  : "Comentar" -> ComentarDoc
}

contact Comentador {
  role: "Comentador"
  : "Comentar" -> ComentarDoc
}
``` 

### Cenas principais
Cenas centrais e que são comumente o ponto inicial de interação podem ser precedidas da palavra `main`, destacando-a no diagrama.
```
main scene Inicio {
  //...
}
```

### Converas preferidas
Quando há mais de uma forma de atingir um objetivo, pode-se destacar as falas que se espera que usuários engagem em determinado momento precedendo-as da palavra `preferred`
```
main scene Inicio {
  
  preferred u: "conversar com Simone" -> Conversa
}

scene Conversa {
  topic: "Conversa"
  let: "user_id = Simone"

  and {
    subtopic: "Enviar mensagem"
    //...
  }
}
```