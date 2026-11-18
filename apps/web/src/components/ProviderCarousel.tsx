import { ProviderLogo } from './ProviderLogo';
import { Badge } from './ui';
import { providerNames } from '../features/providers';

export function ProviderCarousel({ large = false }: { large?: boolean }) {
  return (
    <div className="provider-carousel min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted">Provider integrations are on the roadmap</p>
        <Badge>Planned integrations</Badge>
      </div>
      <div
        className="provider-window overflow-hidden py-1"
        role="region"
        tabIndex={0}
        aria-label={large ? 'Planned provider integrations' : 'Provider logo carousel'}
      >
        <div className="provider-track flex w-max" data-provider-track>
          {[false, true].map((copy) => (
            <ul
              key={String(copy)}
              aria-hidden={copy || undefined}
              className={`provider-set flex shrink-0 list-none gap-4 pr-4 ${copy ? 'provider-copy' : ''}`}
            >
              {providerNames.map((name) => (
                <li
                  key={name}
                  className={`flex shrink-0 items-center justify-center ${large ? 'h-24 w-32' : 'h-16 w-24'}`}
                >
                  <ProviderLogo name={name} compact={!large} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
