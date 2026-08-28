import { createFileRoute } from "@tanstack/react-router";
import { Documento, Secao, SUPORTE } from "@/components/legal/Documento";

// POLÍTICA DE PRIVACIDADE.
//
// ── ESTE TEXTO DESCREVE O QUE O CÓDIGO FAZ ───────────────────────
//
// Cada item aqui foi escrito olhando o sistema, não copiado de modelo:
// os campos vêm do quiz (`quiz-flow.ts`), os subprocessadores são as
// integrações que existem de verdade, e os direitos apontam pra caminhos que
// funcionam (`/descadastrar`, o e-mail do suporte).
//
// Política que promete o que o sistema não faz é pior que não ter política:
// vira prova documental contra a empresa. Se alguma integração mudar, ESTE
// ARQUIVO MUDA JUNTO.
//
// NÃO É PARECER JURÍDICO. É a descrição honesta do tratamento, em linguagem
// que o titular entende, que é o que a LGPD pede. Advogado revisar antes de
// virar tese em processo continua sendo boa ideia.

export const Route = createFileRoute("/privacidade")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Política de Privacidade · Serenata" },
      {
        name: "description",
        content:
          "Como a Serenata coleta, usa e protege os seus dados. Quais dados, por quanto tempo, com quem são compartilhados e como pedir exclusão.",
      },
    ],
  }),
});

function Pagina() {
  return (
    <Documento titulo="Política de Privacidade" atualizado="28 de agosto de 2026">
      <p>
        Esta política explica quais dados a Serenata coleta, por que coleta, com quem
        compartilha e o que você pode pedir a qualquer momento. Ela vale para o site{" "}
        <strong>serenatagift.com</strong> e para os e-mails que enviamos.
      </p>

      <Secao n={1} titulo="Quem é o responsável">
        <p>
          A Serenata (CNPJ 45.835.258/0001-46) é a controladora dos seus dados. Para
          qualquer pedido relacionado a esta política, escreva para{" "}
          <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
            {SUPORTE}
          </a>
          . Respondemos em até 15 dias.
        </p>
      </Secao>

      <Secao n={2} titulo="Quais dados coletamos">
        <p>
          <strong>O que você escreve no quiz.</strong> Para quem é a música, o nome ou
          apelido dessa pessoa, a ocasião, o estilo, o tipo de voz, e a história que você
          conta. Se você usar a opção de falar em vez de digitar, o áudio é transcrito em
          texto e o áudio original é descartado.
        </p>
        <p>
          <strong>Seu contato.</strong> O e-mail, sempre. O WhatsApp só se você escolher
          deixar, e ele existe para um caso: o e-mail voltar ou se perder, e a gente
          precisar te achar para você não ficar sem o que pagou.
        </p>
        <p>
          <strong>Fotos.</strong> Só depois da compra, e só se você subir, para montar a
          página presente e o quadro.
        </p>
        <p>
          <strong>De onde você veio.</strong> Guardamos os parâmetros do link de entrada
          (utm, gclid, fbclid), o site que te trouxe, e se o acesso foi por celular ou
          computador. Serve para saber qual anúncio funciona.
        </p>
        <p>
          <strong>Dados de pagamento.</strong> Nome e e-mail que você informa, e o valor.{" "}
          <strong>
            Nós não recebemos, não guardamos e não temos acesso a número de cartão, senha
            de banco ou chave PIX.
          </strong>{" "}
          Isso fica com o processador de pagamento.
        </p>
        <p>
          <strong>O que NÃO pedimos:</strong> CPF, endereço, data de nascimento ou
          documento. O PIX na nossa página não exige cadastro.
        </p>
      </Secao>

      <Secao n={3} titulo="Para que usamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Escrever a letra e gerar a música — é o produto.</li>
          <li>Entregar: e-mail com os links, a página presente e o arquivo.</li>
          <li>
            Te lembrar do que ficou pela metade (letra pronta e não comprada, PIX gerado e
            não pago). Todo e-mail desses tem link de descadastro.
          </li>
          <li>Dar suporte quando você escreve.</li>
          <li>Medir qual anúncio traz venda, para não gastar no que não funciona.</li>
          <li>Cumprir obrigações fiscais e legais.</li>
        </ul>
        <p>
          <strong>Não vendemos os seus dados</strong>, e não mandamos propaganda de
          terceiros.
        </p>
      </Secao>

      <Secao n={4} titulo="Com quem compartilhamos">
        <p>
          Só com quem é necessário para o serviço funcionar, e só o mínimo. São eles:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Anthropic (Claude)</strong> — escreve a letra a partir da sua história.
          </li>
          <li>
            <strong>Suno, via kie.ai</strong> — grava a música a partir da letra.
          </li>
          <li>
            <strong>Supabase</strong> — banco de dados e armazenamento dos arquivos.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do site.
          </li>
          <li>
            <strong>Resend</strong> — envio dos e-mails.
          </li>
          <li>
            <strong>Woovi</strong> (PIX) e <strong>Perfect Pay</strong> (cartão) —
            processamento do pagamento.
          </li>
          <li>
            <strong>Google Ads e Google Analytics</strong> — medição de anúncio. Enviamos o
            identificador do clique e o valor da compra, nunca a sua história nem a letra.
          </li>
        </ul>
        <p>
          Parte desses serviços fica fora do Brasil. Ao usar a Serenata você concorda com a
          transferência internacional necessária para o serviço funcionar.
        </p>
      </Secao>

      <Secao n={5} titulo="A sua história e a sua música">
        <p>
          A história que você escreve é usada para gerar a letra e fica guardada com o seu
          pedido, para o caso de você precisar refazer, e para o suporte conseguir te
          ajudar. <strong>Ela não é publicada, não é vendida e não vira exemplo</strong>{" "}
          sem a sua autorização por escrito.
        </p>
        <p>
          A página presente fica em um endereço com código único e{" "}
          <strong>não é indexada por buscadores</strong>. Quem tem o link vê a página —
          então mande só para quem você quer.
        </p>
      </Secao>

      <Secao n={6} titulo="Cookies e medição">
        <p>
          Usamos armazenamento local do navegador para lembrar onde você parou no quiz e
          qual versão do site te foi mostrada. Usamos Google Analytics e Google Ads para
          medir de onde vêm as visitas e as compras.
        </p>
        <p>
          <strong>Nas páginas que carregam código ou dado seu</strong> — a página presente,
          o editor, o painel — <strong>não carregamos nenhum script de terceiro</strong>.
          Isso é decisão de arquitetura, não promessa: aquelas rotas estão numa lista que
          bloqueia isso.
        </p>
      </Secao>

      <Secao n={7} titulo="Por quanto tempo guardamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Quem comprou:</strong> a música, a página e os dados do pedido ficam
            enquanto a sua conta existir. É o que faz o link continuar funcionando.
          </li>
          <li>
            <strong>Quem não comprou:</strong> a letra e as respostas ficam por até 12
            meses, e depois são apagadas.
          </li>
          <li>
            <strong>Registros de pagamento:</strong> 5 anos, por obrigação fiscal.
          </li>
        </ul>
      </Secao>

      <Secao n={8} titulo="Os seus direitos">
        <p>Pela LGPD, você pode pedir a qualquer momento:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>confirmação de que tratamos dados seus, e acesso a eles;</li>
          <li>correção do que estiver errado ou incompleto;</li>
          <li>exclusão dos seus dados;</li>
          <li>portabilidade;</li>
          <li>saber com quem compartilhamos;</li>
          <li>revogar consentimento e parar de receber e-mails.</li>
        </ul>
        <p>
          Para parar os e-mails, o link de descadastro está no rodapé de cada um. Para
          qualquer outro pedido, escreva para{" "}
          <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
            {SUPORTE}
          </a>{" "}
          do endereço que você usou na compra.
        </p>
        <p>
          Uma ressalva honesta: <strong>apagar tudo apaga a sua música e a sua página</strong>.
          Se você pedir exclusão, o link que você mandou para alguém para de funcionar. A
          gente avisa antes de executar.
        </p>
      </Secao>

      <Secao n={9} titulo="Segurança">
        <p>
          Os dados trafegam criptografados e ficam em serviços com controle de acesso. O
          acesso ao presente e ao editor é por código único e imprevisível, não por senha
          que dê para adivinhar. Ainda assim, nenhum sistema é infalível: se acontecer
          incidente que possa te afetar, comunicamos você e a ANPD.
        </p>
      </Secao>

      <Secao n={10} titulo="Menores de idade">
        <p>
          O serviço é para maiores de 18 anos. Não coletamos dados de menores
          intencionalmente. Se identificarmos, apagamos.
        </p>
      </Secao>

      <Secao n={11} titulo="Mudanças">
        <p>
          Se esta política mudar, a data no topo muda junto. Mudança relevante é avisada
          por e-mail a quem comprou.
        </p>
      </Secao>
    </Documento>
  );
}
