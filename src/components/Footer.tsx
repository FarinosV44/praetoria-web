import { Fragment } from 'react';
import Link from 'next/link';
import { areasDe, contactos, groups, mensajes, site, whatsapp } from '@/lib/site';
import { Icon } from './Icon';
import { CookieSettingsButton } from './CookieConsent';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer" lang="es">
      <div className="wrap cols">
        <div className="col col--id">
          <img src="/media/logo-praetoria-sin-fondo.png" alt={site.name} width={560} height={109} loading="lazy" />
          <p>
            Abogados en Valencia para empresas y particulares.
            <br />
            <span className="small">Letrado responsable colegiado en el ICAV, n.º {site.collegeNumber}.</span>
          </p>
          <address>
            {site.address.street}
            <br />
            {site.address.postalCode} {site.address.locality} ({site.address.region})
          </address>
        </div>

        <div className="col">
          {(['empresas', 'particulares'] as const).map((g) => (
            <Fragment key={g}>
              <p className="col__title">{groups[g].title}</p>
              <ul>
                {areasDe(g).map((a) => (
                    <li key={a.slug}>
                      <Link href={`/${a.slug}/`}>{a.name}</Link>
                    </li>
                  ))}
                {g === 'particulares' && (
                  <li>
                    <Link href="/abogado-divorcio-horta-nord-valencia/">Divorcio de mutuo acuerdo</Link>
                  </li>
                )}
              </ul>
            </Fragment>
          ))}
        </div>

        <div className="col">
          <p className="col__title">El despacho</p>
          <ul>
            <li>
              <Link href="/el-despacho/">Quiénes somos</Link>
            </li>
            <li>
              <Link href="/blog/">Blog</Link>
            </li>
            <li>
              <a href={site.googleReviews} rel="noopener">
                Reseñas en Google
              </a>
            </li>
          </ul>
        </div>

        <div className="col">
          <p className="col__title">Contacto</p>
          <ul className="contact">
            <li className="contact__area">{contactos.general.etiqueta}</li>
            <li>
              <a href={`tel:${contactos.general.phoneIntl}`}>
                <Icon name="phone" /> {contactos.general.phone}
              </a>
            </li>
            <li>
              <a href={whatsapp(mensajes.general)}>
                <Icon name="whatsapp" /> {contactos.general.escribir}
              </a>
            </li>
            <li className="contact__area">{contactos.laboral.etiqueta}</li>
            <li>
              <a href={`tel:${contactos.laboral.phoneIntl}`}>
                <Icon name="phone" /> {contactos.laboral.phone}
              </a>
            </li>
            <li>
              <a href={whatsapp(mensajes.laboral, 'laboral')}>
                <Icon name="whatsapp" /> {contactos.laboral.escribir}
              </a>
            </li>
            <li className="contact__area">Correo general</li>
            <li>
              <a href={`mailto:${site.email}`}>
                <Icon name="mail" /> {site.email}
              </a>
            </li>
            <li>
              <a href={site.linkedin} rel="noopener">
                <Icon name="linkedin" /> LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="wrap legal">
        <p>
          © {year} {site.legalName}. {site.name}.
        </p>
        <ul>
          <li>
            <Link href="/aviso-legal/">Aviso legal</Link>
          </li>
          <li>
            <Link href="/politica-de-privacidad/">Privacidad</Link>
          </li>
          <li>
            <Link href="/politica-de-cookies/">Cookies</Link>
          </li>
          <CookieSettingsButton />
        </ul>
      </div>
    </footer>
  );
}
