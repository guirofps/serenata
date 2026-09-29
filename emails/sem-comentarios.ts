// Tira os comentários HTML de um e-mail antes de enviar.
//
// Os comentários dos modelos explicam decisões pra quem mantém o código, e
// nenhum deles é pra quem recebe. Dois motivos pra não mandá-los:
//   1. O Yahoo fecha comentário no primeiro "->" e mostra o resto na tela
//      (ver `emails-comentarios.test.ts`: uma compradora leu golpe).
//   2. Na Ballad Gift (EUA) eles citavam a Serenata e o PIX no código-fonte
//      do e-mail americano.
// O que o cliente VÊ não muda: comentário não renderiza em lugar nenhum.

export function semComentarios(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}
