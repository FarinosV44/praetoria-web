import { Fragment } from 'react';
import Link from 'next/link';
import { areas, groups, site, whatsapp } from '@/lib/site';
import { Icon } from './Icon';
import { CookieSettingsButton } from './CookieConsent';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap cols">
        <div className="col col--id">
          <img src="/media/logo-praetoria-sin-fondo.png" alt={site.name} width={560} height={151} loading="lazy" />
          <p>
            {site.lawyer}
            <br />
            Abogado colegiado n.º {site.collegeNumber} del ICAV
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
                {areas
                  .filter((a) => a.group === g)
                  .map((a) => (
                    <li key={a.slug}>
                      <Link href={`/${a.slug}/`}>{a.name}</Link>
                    </li>
                  ))}
                {g === 'particulares' && (
                  <li>
                    <Link href="/abogado-divorcio-horta-nord-valencia/">Divorcio en l&apos;Horta Nord</Link>
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
              <Link href="/abogado-el-puig/">Abogado en El Puig</Link>
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
            <li>
              <a href={`tel:${site.phoneIntl}`}>
                <Icon name="phone" /> {site.phone}
              </a>
            </li>
            <li>
              <a href={whatsapp()}>
                <Icon name="whatsapp" /> WhatsApp
              </a>
            </li>
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
