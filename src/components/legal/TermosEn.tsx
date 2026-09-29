import { Documento, Secao, SUPORTE } from "@/components/legal/Documento";
import { cnpjFormatado } from "@/lib/empresa";
import { DIAS_GARANTIA } from "@/lib/garantia";
import { MARCA } from "@/lib/marca";

// TERMOS DE USO DA BALLAD GIFT (EUA, inglês).
//
// ── ADAPTADO, NÃO TRADUZIDO ──────────────────────────────────────
//
// O texto português fala com o CDC (arrependimento de 7 dias, foro do
// consumidor). Aqui o leitor é o consumidor americano: o que sustenta a
// garantia é a nossa promessa, não uma lei, e o CNPJ precisa vir explicado,
// porque ninguém lá sabe o que é.
//
// A mesma regra do `termos.tsx` vale aqui: prazo, garantia e o que vem na
// compra são os mesmos da tela de venda da Ballad. Se a tela mudar, MUDA AQUI
// TAMBÉM.
//
// ── QUEM VENDE ───────────────────────────────────────────────────
//
// Por ora a MESMA empresa da Serenata (decisão provisória do dono, 29/09). O
// CNPJ sai de `empresa.ts`, nunca digitado aqui, e nome de pessoa física não
// aparece. Endereço americano não existe, então não se inventa um.

export const META_TERMOS_EN = {
  title: `Terms of Service · ${MARCA.nome}`,
  description: `What ${MARCA.nome} delivers, how fast, how the ${DIAS_GARANTIA}-day money-back guarantee works, and what you can do with your song.`,
};

const linkSuporte = (
  <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
    {SUPORTE}
  </a>
);

export function TermosEn() {
  return (
    <Documento titulo="Terms of Service" atualizado="September 29, 2026">
      <p>
        These terms are an agreement between you and {MARCA.nome} ("we", "us"). {MARCA.nome} is
        operated by a company registered in Brazil (CNPJ {cnpjFormatado()}, São Caetano do Sul, SP,
        Brazil). By using <strong>{MARCA.dominio}</strong> or making a purchase, you agree to these
        terms. If you don't agree, please don't use the site.
      </p>
      <p>You must be at least 18 years old to make a purchase.</p>

      <Secao n={1} titulo="What you're buying">
        <p>A digital gift, made from the story you tell us:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>the full song, sung, in two versions of the same lyrics;</li>
          <li>a gift page you can personalize with your photos, to share by link or QR code;</li>
          <li>the MP3 file, to download and keep.</li>
        </ul>
        <p>
          <strong>It's a one-time payment.</strong> It's not a subscription, it doesn't renew, and
          we never charge you again unless you ask for something new.
        </p>
      </Secao>

      <Secao n={2} titulo="Try it before you pay">
        <p>
          You tell us the story and get the lyrics and a sung preview for free, before paying
          anything. Payment unlocks the full song and the rest of the gift.
        </p>
        <p>
          We start recording before you pay, so you don't have to wait afterward. If you decide not
          to buy, that cost is on us.
        </p>
      </Secao>

      <Secao n={3} titulo="Songs are made with AI">
        <p>
          We want to be clear about this: the lyrics are written by an AI language model and the
          music is created by an AI music generation service, based on what you tell us. No human
          musician records your song, and the voice is not the voice of any real singer.
        </p>
        <p>
          The <strong>lyrics are unique</strong>, written from your story. The melody and
          arrangement are generated, so <strong>we don't promise an exclusive melody</strong>: two
          different stories may end up with songs in a similar style.
        </p>
        <p>
          Songs don't imitate specific artists, and we don't put the names of artists, bands or
          brands in them.
        </p>
      </Secao>

      <Secao n={4} titulo="Delivery">
        <p>
          Your song is usually ready in <strong>less than 5 minutes</strong>, and always within{" "}
          <strong>30 minutes</strong>. It shows up on screen right away, and we also send it to you
          by email.
        </p>
        <p>
          If it takes longer because of a problem on our side, email {linkSuporte}. We'll fix it or
          refund you, your choice.
        </p>
      </Secao>

      <Secao n={5} titulo={`${DIAS_GARANTIA}-day money-back guarantee`}>
        <p>
          Not happy with it? Email {linkSuporte} within{" "}
          <strong>{DIAS_GARANTIA} days of your purchase</strong> and we'll refund{" "}
          <strong>100% of what you paid</strong>. No questions asked, no discount offers to talk you
          out of it, no hoops.
        </p>
        <p>
          The guarantee applies even after you've listened to and downloaded everything. Refunds go
          back to your original payment method. Depending on your bank, it may take a few business
          days to show up.
        </p>
        <p>
          Something not quite right, like a word or the voice? After your purchase you can also ask
          us to adjust or re-record your song. Just email us.
        </p>
      </Secao>

      <Secao n={6} titulo="Price and payment">
        <p>
          The price is shown before you pay, in US dollars. Payments are processed by{" "}
          <strong>Stripe</strong> (credit and debit cards, Apple Pay and Google Pay).{" "}
          <strong>We never see or store your card number.</strong>
        </p>
        <p>
          We may change our prices at any time, but{" "}
          <strong>a price change never applies to an order you've already placed</strong>.
        </p>
      </Secao>

      <Secao n={7} titulo="What you can do with your song">
        <p>
          You get a <strong>personal, non-commercial license</strong> to your song: listen to it,
          share it, give it as a gift, play it at a party, and post it on your personal social
          media.
        </p>
        <p>
          What's not included: commercial use (selling it, or using it in ads or as a product
          soundtrack), uploading it to streaming platforms as your own work, claiming it in content
          ID systems, and reselling it. Because the song is made with AI, we don't promise that you
          can register an exclusive copyright in it. If you need something else, get in touch.
        </p>
      </Secao>

      <Secao n={8} titulo="Your content">
        <p>
          When you write a story or upload photos, you confirm that the story is yours to tell and
          that you have the right to use the names and photos you send.
        </p>
        <p>Please don't send content that:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>is illegal;</li>
          <li>is hateful or discriminatory, or encourages violence;</li>
          <li>harasses, threatens, humiliates or exposes someone;</li>
          <li>involves a minor in an inappropriate way;</li>
          <li>
            infringes someone else's rights, like copyrighted lyrics or someone's private
            information.
          </li>
        </ul>
        <p>
          We may refuse to create a song or cancel an order that breaks these rules. If you already
          paid, we'll refund you. You're responsible for what you write.
        </p>
        <p>
          We use what you send only to create and deliver your gift, and to help you when you
          contact us. We never publish your story or use it as an example without your written
          permission.
        </p>
      </Secao>

      <Secao n={9} titulo="Your gift page and links">
        <p>
          Your gift page lives at a unique, unlisted address and doesn't show up in search engines.
          Anyone who has the link can see the page, so <strong>the link is the key</strong>: only
          send it to people you want to see it.
        </p>
        <p>
          Your gift page doesn't expire. If we ever have to take a page down for a technical or
          legal reason, we'll let you know first and send you your files.
        </p>
      </Secao>

      <Secao n={10} titulo="Limits of our responsibility">
        <p>
          We work hard to keep everything running, but the service depends on other companies (AI
          providers, hosting, email). The service is provided "as is". If something goes wrong, our
          responsibility is limited to redoing the work or refunding what you paid for that order.
        </p>
        <p>
          Nothing in these terms takes away rights you have as a consumer that can't be waived under
          the law where you live.
        </p>
      </Secao>

      <Secao n={11} titulo="Problems and disputes">
        <p>
          If something goes wrong, please email {linkSuporte} first. Most issues are solved quickly,
          and a refund is always an option within the guarantee period.
        </p>
      </Secao>

      <Secao n={12} titulo="Changes to these terms">
        <p>
          If we change these terms, the date at the top changes too. Changes never apply to orders
          placed before them.
        </p>
      </Secao>
    </Documento>
  );
}
