# Aetheria Online

RPG de fantasia para navegador (PC e celular), com multiplayer em tempo real.

## Jogar com servidor próprio (multiplayer público)

Requer apenas Node.js 18+ (sem dependências):

    node server.js          # abre em http://localhost:8080
    PORT=3000 node server.js

Hospede a pasta inteira em qualquer VPS/serviço que rode Node (Railway, Render, Fly.io, VPS).
Todos que abrirem o endereço jogam no mesmo mundo: veem uns aos outros por zona, chat global,
ranking e save na nuvem (pasta `saves/`). Use HTTPS/WSS em produção (proxy nginx/Caddy).

## Estrutura

- `index.html`, `css/style.css` — página e interface (PC + toque)
- `js/data.js` — classes, monstros, zonas, itens, missões, loja de cash
- `js/world.js` — geração procedural dos mapas (determinística)
- `js/render.js` — gráficos (Canvas 2D, arte procedural)
- `js/game.js` — combate, loot, progressão, profissões, asas
- `js/net.js` — rede (plataforma Claude ou WebSocket próprio)
- `js/ui.js`, `js/main.js` — janelas, HUD, entrada, laço principal
- `server.js` — servidor HTTP + WebSocket

## Gráficos 3D (Blender)

A pasta `img/` guarda sprites renderizados no Blender (fundo transparente, olhando para a direita).
Hoje cobrem: Guerreiro, monstros e chefes das zonas 1 e 2, e árvores/rochas da Vila e das zonas 1 e 2.
O que não tem sprite continua com a arte procedural. Para adicionar um monstro: salve `img/mob_<id>.png`
e registre a altura em `SPR3D_MOB` (js/render.js).

## Grupo (só no servidor próprio)

Até 4 jogadores. Toque em um jogador, use a janela 🌐 Jogadores, ou no chat:

    /grupo convidar <jogador>   /grupo aceitar   /grupo recusar   /grupo sair

Para quem está na mesma zona: XP e ouro de cada monstro ganham +20% por companheiro e são divididos
igualmente; materiais vão para todos; cada equipamento é sorteado entre os membros; abates contam
nas missões de todos.

## Loja de cash

Está desativada (`CASH_ENABLED = false` em `js/data.js`) e exibida como "EM BREVE".
Antes de ativar: mover a validação de ouro/itens/XP para o servidor (hoje a lógica roda
no navegador de cada jogador) e integrar um gateway de pagamento com confirmação por webhook.

## Skins e comandos de ADM

Skins mudam só a aparência. No chat do jogo:

    /adm <chave>                      (servidor próprio; a chave aparece ao iniciar ou via ADMIN_KEY=...)
    /skin dar <jogador> <skin>        skins: godslayer, padreh, tanderw
    /skin tirar <jogador> <skin>
    /skin lista

Na versão hospedada no Claude, o dono/editor da página já é ADM e também tem um painel
na janela "Visuais". Para criar novas skins: adicione em `SKINS` (js/data.js) e em
`SKIN_DRAW` (js/render.js).

## Publicar grátis no Render

1. Envie o conteúdo desta pasta para um repositório no GitHub (os arquivos na raiz).
2. Em render.com: New → Web Service → escolha o repositório.
   Runtime: Node · Build Command: `echo ok` · Start Command: `node server.js` · Plano: Free.
3. Em Environment, crie as variáveis:
   - `ADMIN_KEY` — sua senha de ADM.
   - `GITHUB_TOKEN` — (recomendado) token para guardar os dados de forma permanente. Veja abaixo.
4. Deploy. No jogo, `/adm SUASENHA` no chat te dá poderes de ADM.

## Painel ADM

Abra `https://SEU-JOGO.onrender.com/admin` e entre com a `ADMIN_KEY`.

- **Visão geral** — quem está online, aviso para todos, alertas de jogadores travados e de quedas no funil.
- **Jogadores** — lista completa; clique num jogador para ver a linha do tempo dele e agir:
  mensagem privada, curar, teleportar, dar ouro/XP/itens, expulsar, silenciar, banir, dar skins, anotações.
- **Funil** — quantos jogadores chegam a cada missão da história e a cada faixa de nível; as maiores quedas ficam em vermelho.
- **Missões** — tempo típico de cada missão (tempo de jogo ativo), mortes, quem está preso agora e quem largou o jogo nela.
- **Onde saem** — jogadores que sumiram, agrupados pelo ponto onde pararam; onde as sessões costumam terminar; duração das sessões.
- **Atividade** — horários em que entram, jogadores por dia, tempo por zona, o que mais fazem, monstros que mais matam.
- **Linha do tempo** — todos os eventos, filtráveis por jogador e tipo.
- **Chat** — histórico do chat com botão de silenciar.
- **Servidor** — modo manutenção, mensagem de boas-vindas, banidos, onde os dados estão guardados, zerar estatísticas de teste.

## Guardar os dados para sempre (grátis) com GITHUB_TOKEN

O plano gratuito do Render apaga o disco quando o servidor dorme. Com um `GITHUB_TOKEN`, o servidor
guarda saves, ranking, skins, bans e estatísticas num **Gist secreto** da sua conta do GitHub
(salva a cada 90 s, quando o último jogador sai e quando o servidor desliga) e recarrega tudo ao ligar.

1. GitHub → foto → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
2. Nome: `aetheria`. Expiration: **No expiration**. Marque **somente** a permissão **gist**. Gere e copie o token.
3. No Render: Environment → `GITHUB_TOKEN` = o token copiado → Save (o serviço reinicia sozinho).
4. No painel ADM, o selo do topo deve mostrar "☁️ dados salvos no GitHub".

O Gist aparece em gist.github.com com o nome "aetheria-online-data (nao apagar)".
