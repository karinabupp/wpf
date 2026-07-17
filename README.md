[deepseek_markdown_20260717_70a173.md](https://github.com/user-attachments/files/30134885/deepseek_markdown_20260717_70a173.md)
# 🗺️ WPF Pipeline Dashboard

Dashboard interativo para gerenciamento de pipeline de federações, comitês, metas (KPIs), tarefas, análise de redes sociais e marketing, tudo integrado com mapas mundiais e dados ao vivo via Google Sheets.

---

## 📋 Funcionalidades

- **Mapa Mundi Interativo**  
  Visualize o status de cada país no pipeline (Federations ou Committee) com cores por estágio.  
  - Clique em um país para editar seus dados.  
  - Busca por país com zoom automático.  
  - Modo "By state" para países com divisões internas (EUA, Brasil, Reino Unido, China).

- **Metas (KPIs)**  
  Acompanhe indicadores estratégicos com histórico mensal, tendências e alertas de tarefas atrasadas.  
  - Categorias: Institutional, Marketing, CBTH, Geral.  
  - Pausar metas, editar histórico e arrastar para reordenar.

- **Tarefas (Tasks)**  
  Gerenciamento hierárquico de tarefas com subtasks, responsáveis, datas e vinculação a KPIs.  
  - Visualização em lista, atrasadas e visão geral com estatísticas.  
  - Arrastar subtasks entre tarefas, edição em linha e suporte a múltiplos responsáveis.

- **Redes Sociais (Social)**  
  Acompanhe a presença digital das federações (Instagram, Facebook, X, TikTok, Website) com classificação automática de desempenho.  
  - Modo mundial e Brasil (estados).  
  - Análise via IA (Claude) a partir de links fornecidos.

- **Marketing**  
  Dashboards com gráficos ao vivo a partir de planilhas do Google:  
  - **WPF Site**: meta vs. realizado por mês, acessos por categoria.  
  - **Adwords**: acessos realizados vs. meta, CPC (meta 5.16), budget mensal e total.  
  - **Social Media**: evolução de seguidores, reach, views e likes.

- **Sincronização em Nuvem**  
  Todos os dados são salvos automaticamente no **localStorage** e sincronizados entre dispositivos via **JSONBin.io** (push debounced, com detecção de conflitos por revisão).

- **Exportação / Importação**  
  Exporte todos os dados (Federations, Committee, estados, goals, tasks, social) para um arquivo JSON e importe de volta.

---

## 🚀 Como usar

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/wpf-pipeline-dashboard.git
   cd wpf-pipeline-dashboard
