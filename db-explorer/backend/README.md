# 🗄️ DB Explorer — PostgreSQL

Interface web local para conectar, explorar e pesquisar dados em bancos PostgreSQL.

## 🚀 Como usar

### 1. Pré-requisitos
- Node.js 18+ instalado
- Acesso a um banco PostgreSQL

### 2. Instalar e rodar

```bash
cd backend
npm install
node server.js
```

Acesse: **http://localhost:3001**

### 3. Configuração via `.env` (opcional)

Copie o `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

---

## 🔍 Funcionalidades

| Recurso | Descrição |
|---|---|
| **Conexão dinâmica** | Conecte a qualquer banco PostgreSQL pela interface |
| **Árvore de tabelas** | Visualize todas as tabelas e colunas do banco |
| **Busca por colunas** | Selecione quais colunas pesquisar (nome, CPF, CNPJ, endereço…) |
| **Busca LIKE / Exata** | Escolha entre busca parcial ou correspondência exata |
| **Normalização CPF/CNPJ** | Busca com ou sem máscara automaticamente |
| **SQL Livre** | Execute qualquer SELECT diretamente |
| **Exportar CSV** | Baixe os resultados em CSV |
| **Highlight** | Termo pesquisado destacado nos resultados |

## 🔒 Segurança

- Apenas queries `SELECT`, `WITH` e `EXPLAIN` são permitidas no SQL Livre
- Identificadores de tabela/coluna são validados contra SQL Injection
- Rate limit de 100 requisições/minuto
- Headers de segurança via Helmet

## 📁 Estrutura

```
db-explorer/
├── backend/
│   ├── server.js        # API Node.js + Express
│   ├── .env.example     # Variáveis de ambiente
│   └── package.json
└── frontend/
    └── public/
        └── index.html   # Interface completa (HTML/CSS/JS)
```
