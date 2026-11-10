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
3. Em Environment, crie a variável `ADMIN_KEY` com uma senha só sua.
4. Deploy. No jogo, digite no chat `/adm SUASENHA` para virar ADM.

Plano gratuito: o servidor dorme após 15 min sem jogadores (leva ~1 min para acordar) e a
pasta `saves/` é apagada quando ele dorme ou reinicia (ranking e skins dadas pelo ADM somem;
o progresso de cada jogador continua salvo no próprio navegador).
