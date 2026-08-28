import { createFileRoute } from "@tanstack/react-router";
import { Documento, Secao, SUPORTE } from "@/components/legal/Documento";
import { DIAS_GARANTIA } from "@/lib/garantia";

// TERMOS DE USO.
//
// ── DESCREVE O QUE O SISTEMA REALMENTE ENTREGA ───────────────────
//
// Prazo, garantia, o que está incluído e o que não está — tudo tirado do que
// o produto faz hoje, não de modelo. O prazo é o mesmo que o FAQ da oferta
// promete ("até 30 minutos, normalmente menos de 5"), a garantia é a mesma de
// `garantia.ts`, e a lista do que vem é a mesma da tela de checkout.
//
// Se qualquer um desses três mudar na tela, MUDA AQUI TAMBÉM. Termo que
// promete diferente do que a página de venda promete não protege ninguém: no
// CDC vale o que foi anunciado, e a divergência só serve pra provar má-fé.
//
// ── O QUE ESTE TEXTO NÃO ESCONDE ─────────────────────────────────
//
// Que a música é gerada por inteligência artificial, e que não se pede
// exclusividade de melodia. Esconder isso seria vender coisa diferente da
// entregue, e é o tipo de omissão que vira reembolso e processo.

export const Route = createFileRoute("/termos")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Termos de Uso · Serenata" },
      {
        name: "description",
        content:
          "O que a Serenata entrega, em quanto tempo, como funciona a garantia de 7 dias e o que você pode fazer com a sua música.",
      },
    ],
  }),
});

function Pagina() {
  return (
    <Documento titulo="Termos de Uso" atualizado="28 de agosto de 2026">
      <p>
        Estes termos valem entre você e a Serenata (CNPJ 45.835.258/0001-46). Ao usar o
        site ou comprar, você concorda com eles.
      </p>

      <Secao n={1} titulo="O que você compra">
        <p>Um presente digital, montado a partir da história que você conta:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>a música completa, cantada, em duas gravações da mesma letra;</li>
          <li>a página presente, com as suas fotos, para mandar por link ou QR Code;</li>
          <li>o karaokê, com a letra acendendo no tempo da música;</li>
          <li>o arquivo MP3 para baixar e guardar.</li>
        </ul>
        <p>
          <strong>É pagamento único.</strong> Não é assinatura, não renova, e não cobramos
          nada depois sem você pedir.
        </p>
      </Secao>

      <Secao n={2} titulo="A letra é grátis. A música é paga.">
        <p>
          Você escreve a história e recebe a letra sem pagar nada, e ela é sua de qualquer
          jeito. O pagamento libera a gravação e o resto do presente.
        </p>
        <p>
          A gravação começa antes de você pagar, para você não esperar depois. Se você não
          comprar, o custo é nosso.
        </p>
      </Secao>

      <Secao n={3} titulo="A música é gerada por inteligência artificial">
        <p>
          Dizemos isso com todas as letras porque é o que é: a letra é escrita e a música é
          gravada por IA, a partir do que você conta. Não há músico humano gravando, e a
          voz não é de um cantor específico.
        </p>
        <p>
          A <strong>letra é única</strong>, escrita a partir da sua história. A melodia e o
          arranjo são gerados, e{" "}
          <strong>não garantimos exclusividade de melodia</strong> — duas pessoas com
          histórias diferentes podem receber músicas parecidas no estilo.
        </p>
      </Secao>

      <Secao n={4} titulo="Prazo">
        <p>
          Até <strong>30 minutos</strong>, e normalmente menos de 5. Você recebe um e-mail
          quando fica pronta, e também consegue montar o presente na hora, na própria tela.
        </p>
        <p>
          Se passar disso por falha nossa, escreva para{" "}
          <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
            {SUPORTE}
          </a>
          : a gente refaz ou devolve o dinheiro, você escolhe.
        </p>
      </Secao>

      <Secao n={5} titulo={`Garantia de ${DIAS_GARANTIA} dias, sem perguntas`}>
        <p>
          Não gostou? Escreva dentro de <strong>{DIAS_GARANTIA} dias</strong> e devolvemos{" "}
          <strong>100% do valor</strong>. Não pedimos justificativa, não oferecemos
          desconto para você desistir do reembolso, e não dificultamos.
        </p>
        <p>
          É mais do que a lei exige: o direito de arrependimento do CDC é de 7 dias para
          compra fora do estabelecimento, e a nossa garantia vale igual mesmo depois de
          você ter ouvido e baixado tudo.
        </p>
        <p>O reembolso volta pelo mesmo meio de pagamento, em até 10 dias úteis.</p>
      </Secao>

      <Secao n={6} titulo="O que você pode fazer com a música">
        <p>
          A música é sua para <strong>uso pessoal</strong>: ouvir, mandar para quem você
          quiser, tocar na festa, postar nas suas redes.
        </p>
        <p>
          O que não está incluído: uso comercial (vender, usar em anúncio, em trilha de
          produto), distribuição em plataformas de streaming como se fosse obra sua, e
          revenda. Se precisar de algo assim, fale com a gente.
        </p>
      </Secao>

      <Secao n={7} titulo="O que você garante ao escrever">
        <p>
          Que a história é sua para contar, e que você tem o direito de usar os nomes e as
          fotos que enviar.
        </p>
        <p>Não geramos música com conteúdo que:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>ofenda, ameace, humilhe ou exponha alguém;</li>
          <li>seja discriminatório ou incite violência;</li>
          <li>envolva menor de idade de forma imprópria;</li>
          <li>viole direito de terceiro.</li>
        </ul>
        <p>
          Nesses casos cancelamos o pedido e devolvemos o valor. A responsabilidade pelo
          que é escrito é de quem escreve.
        </p>
      </Secao>

      <Secao n={8} titulo="A página presente e os links">
        <p>
          A página fica num endereço com código único e não aparece em buscadores. Quem tem
          o link vê a página — <strong>o link é a chave</strong>, então mande só para quem
          você quer.
        </p>
        <p>
          Mantemos a página no ar enquanto a sua conta existir. Se precisarmos tirar do ar
          por motivo técnico ou legal, avisamos antes e entregamos os arquivos.
        </p>
      </Secao>

      <Secao n={9} titulo="Pagamento">
        <p>
          PIX processado pela Woovi e cartão pela Perfect Pay. O valor é o que aparece na
          tela no momento da compra. Podemos mudar preços a qualquer momento, e{" "}
          <strong>a mudança nunca vale para pedido já feito</strong>.
        </p>
      </Secao>

      <Secao n={10} titulo="Limite de responsabilidade">
        <p>
          Fazemos o possível para o serviço funcionar sempre, mas ele depende de terceiros
          (provedores de IA, hospedagem, e-mail). Se algo falhar, nossa responsabilidade se
          limita a refazer o trabalho ou devolver o que você pagou.
        </p>
        <p>Nada aqui afasta os seus direitos como consumidor.</p>
      </Secao>

      <Secao n={11} titulo="Foro e lei">
        <p>
          Aplica-se a lei brasileira. Fica eleito o foro do domicílio do consumidor, como
          manda o CDC.
        </p>
      </Secao>
    </Documento>
  );
}
