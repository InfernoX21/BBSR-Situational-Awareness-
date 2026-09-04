/**
 * The honest page for a destination the new information architecture names but
 * this deployment cannot fill.
 *
 * The IA describes the operational domains a city operations centre has, and
 * that is the right shape for the navigation to hold — an operator looking for
 * fleet telemetry should find where it *would* live rather than concluding ARKA
 * has no concept of it. But a page is not allowed to invent its contents to
 * justify its place in the rail. So each of these destinations states which
 * integration is missing and what connecting it would produce, and shows nothing
 * else. That is a specification an integrator can act on; a mocked-up dashboard
 * is not.
 *
 * A destination graduates out of this file the moment a real source exists for
 * it. Nothing here is a permanent home.
 */

import { ModuleHeader } from '../../shell/navigation';
import { Page, PageBody, Panel, PanelBody, UnavailableState } from '../../ui';
import type { NavItem } from '../../types';

interface NotConfiguredViewProps {
  /** The destination. Title, breadcrumb and sibling tabs derive from it. */
  item: NavItem;
  subtitle: string;
  /** The integration ARKA is waiting on, named precisely enough to procure. */
  source: string;
  /** What it would take, and what the page would then show. */
  reason: string;
}

export function NotConfiguredView({ item, subtitle, source, reason }: NotConfiguredViewProps) {
  return (
    <Page>
      <ModuleHeader item={item} subtitle={subtitle} />
      <PageBody>
        <Panel>
          <PanelBody>
            <UnavailableState notConfigured source={source} reason={reason} />
          </PanelBody>
        </Panel>
      </PageBody>
    </Page>
  );
}
