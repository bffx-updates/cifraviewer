# Cifra Viewer

Webapp (PWA) para exibir cifras em imagem (JPG/PNG) no iPad, com navegação por
teclado ou pedal Bluetooth de virar página.

## Funcionalidades

- 📂 Abre várias imagens de uma vez (ordenadas pelo nome do arquivo)
- ⌨️ Teclas configuráveis para **próxima** e **anterior** (padrão: → e ←) —
  funciona com pedais Bluetooth (AirTurn, PageFlip etc.), que enviam teclas
  como PgUp/PgDn ou setas
- ⛶ Botão de tela cheia
- 👆 No iPad: toque nas laterais ou deslize para navegar; toque no centro
  mostra/esconde a barra
- 🔆 Mantém a tela ligada durante o uso (Wake Lock)
- 📴 Funciona offline depois do primeiro acesso (Service Worker)

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `cifra-viewer`).
2. Envie todos os arquivos desta pasta para o repositório:
   ```bash
   git init
   git add .
   git commit -m "Cifra Viewer"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/cifra-viewer.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings → Pages → Source** e escolha
   **Deploy from a branch**, branch `main`, pasta `/ (root)`.
4. O app ficará em `https://SEU_USUARIO.github.io/cifra-viewer/`.

## Instalar no iPad

1. Abra o endereço acima no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone criado — o app roda em tela cheia, sem a barra do Safari.

> Dica: no modo instalado (PWA) o app já ocupa a tela toda; o botão ⛶ é mais
> útil quando aberto direto no navegador.
