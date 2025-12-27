# ERP Desdobra - Design System & UI Rules

Este documento define a "Fonte Única de Verdade" para o design da interface do ERP. O objetivo é garantir consistência total e evitar variações desnecessárias.

## 1. O Padrão "Card Ouro"

Todos os blocos de conteúdo principais devem seguir este padrão:

- **Componente**: Usar obrigatoriamente o componente `Card`.
- **Raio de Borda (Radius)**: `rounded-2xl` (Token: `--radius-card`).
- **Sombra (Shadow)**: `shadow-card` (Token: `--shadow-card`).
- **Fundo (Background)**: `bg-white`.
- **Borda**: `border border-gray-100` (ou token oficial).

### CardHeader Padrão (CardHeaderStandard)
Fica PROIBIDO criar headers customizados com backgrounds coloridos ou divisores complexos sem necessidade.
- **Estrutura**: Ícone + Título à esquerda e Ações à direita.
- **Subtítulo**: Evitar subtítulos dentro do header (usar `CardDescription` apenas se for essencial).
- **Divisor**: Sem linha divisória (`border-b`) entre header e content por padrão.

## 2. Elementos de Formulário

### Inputs e Selects
- **Altura**: Padrão de 40px (`h-10`).
- **Radius**: `rounded-lg` (8px).
- **Fundo**: `bg-white` ou `bg-gray-50` para leitura.

## 3. Feedback Visual (Toasts/Alerts)

- **Alerts**: Devem usar o componente `Alert` padronizado.
- **Toast**: Barra lateral colorida indicando o status (Success, Error, Info).

## 4. Regras e Proibições (Strict Mode)

Para manter o sistema "limpo", ficam proibidos:

- ❌ **shadow-lg / shadow-xl**: Usar apenas `shadow-card` ou `shadow-float`.
- ❌ **rounded-xl**: O padrão para cards é `rounded-2xl`. Para inputs/botones é `rounded-lg`.
- ❌ **p-[...] (Arbitrário)**: Proibido padding arbitrário. Use a escala fixa do Tailwind (p-4, p-6).
- ❌ **Header Colorido**: Headers de card devem ser `bg-transparent`.

## 5. Como implementar

Ao criar uma nova tela ou componente:

```tsx
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Users } from "lucide-react";

export function MinhaTabela() {
  return (
    <Card>
      <CardHeaderStandard 
        icon={<Users className="w-5 h-5" />}
        title="Usuários"
        actions={<Button>Novo</Button>}
      />
      <CardContent>
        {/* Conteúdo aqui */}
      </CardContent>
    </Card>
  );
}
```
