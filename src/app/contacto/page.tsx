import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Icon } from '@/components/Icon';
import { site, whatsapp } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Contacto | Abogados en Valencia y El Puig",
  description: "Contacta con Praetoria División Jurídica en Valencia y El Puig. Primera valoración de tu caso en transporte, mercantil, civil, familia, Hacienda o patrimonio.",
  path: '/contacto/',
});

export default function ContactoPage() {
  return (
    <div className="page-contacto">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Contacto' }]} />
          <h1>Cuéntanos tu caso</h1>
          <p className="lede">
            Cada caso merece ser escuchado con atención. Escríbenos por el medio que prefieras y te responderemos lo antes
            posible.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <form className="form" name="contacto" method="POST" action="/gracias/" data-netlify="true" netlify-honeypot="empresa-web">
            <input type="hidden" name="form-name" value="contacto" />
            <p className="hp"><label>No rellenes este campo <input name="empresa-web" tabIndex={-1} autoComplete="off" /></label></p>

            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" autoComplete="name" required />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="email">Correo electrónico</label>
                <input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="field">
                <label htmlFor="telefono">Teléfono <span className="muted">(opcional)</span></label>
                <input id="telefono" name="telefono" type="tel" autoComplete="tel" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="area">¿Sobre qué es tu consulta?</label>
              <select id="area" name="area">
                <option>Transporte y logística</option>
                <option>Mercantil y sociedades</option>
                <option>Hacienda y Seguridad Social</option>
                <option>Civil, herencias y vivienda</option>
                <option>Familia y divorcio</option>
                <option>Arte y patrimonio</option>
                <option>Otro asunto</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="mensaje">¿Qué ha pasado y qué te gustaría conseguir?</label>
              <textarea id="mensaje" name="mensaje" required></textarea>
            </div>
            <fieldset className="field">
              <legend>¿Cómo prefieres que te contactemos?</legend>
              <div className="radios">
                <label><input type="radio" name="preferencia" value="Llamada" defaultChecked /> Llamada</label>
                <label><input type="radio" name="preferencia" value="Correo" /> Correo</label>
                <label><input type="radio" name="preferencia" value="WhatsApp" /> WhatsApp</label>
              </div>
            </fieldset>
            <label className="check">
              <input type="checkbox" name="privacidad" required />
              <span>He leído y acepto la <Link href="/politica-de-privacidad/">política de privacidad</Link>.</span>
            </label>
            <p className="small muted">
              Enviar esta consulta no crea una relación abogado-cliente ni interrumpe ningún plazo. No adjuntes documentos
              sensibles: te los pediremos por un canal seguro si hace falta.
            </p>
            <div><button className="btn btn--red" type="submit">Enviar mi consulta</button></div>
          </form>

          <aside className="direct">
            <h2>O habla directamente con nosotros</h2>
            <ul>
              <li>
                <a href={`tel:${site.phoneIntl}`}><Icon name="phone" /><span><strong>{site.phone}</strong>Teléfono</span></a>
              </li>
              <li>
                <a href={whatsapp('Hola, quiero consultar mi caso con Praetoria.')}><Icon name="whatsapp" /><span><strong>WhatsApp</strong>Al mismo número</span></a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}><Icon name="mail" /><span><strong>{site.email}</strong>Correo electrónico</span></a>
              </li>
              <li>
                <span className="noa"><Icon name="pin" /><span><strong>{site.address.street}</strong>{site.address.postalCode} {site.address.locality} ({site.address.region})</span></span>
              </li>
            </ul>
            <a className="btn btn--ghost" href="https://www.google.com/maps/dir/?api=1&destination=Calle%20Pintor%20Francisco%20Ribalta%204%2C%2046540%20El%20Puig%2C%20Valencia" rel="noopener">Cómo llegar en Google Maps</a>
          </aside>
        </div>
      </section>

    </div>

  );
}
