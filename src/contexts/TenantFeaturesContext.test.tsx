import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider, useTenantFeatures } from './TenantFeaturesContext';

function Probe() {
  const { serverWorkspaceV2, tableAccountV1, orderAmendmentsV1 } = useTenantFeatures();
  return (
    <output role="status">{`${String(serverWorkspaceV2)}:${String(tableAccountV1)}:${String(orderAmendmentsV1)}`}</output>
  );
}

describe('TenantFeaturesContext', () => {
  it('defaults closed when no provider is present', () => {
    render(<Probe />);

    expect(screen.getByRole('status')).toHaveTextContent('false:false:false');
  });

  it.each([true, false])('provides the server workspace rollout value (%s)', (enabled) => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: enabled }}>
        <Probe />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(`${String(enabled)}:false:false`);
  });

  it('keeps the account presentation flag independent from server workspace v2', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: false, tableAccountV1: true }}>
        <Probe />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('false:true:false');
  });

  it('keeps the amendment rollout independent from the existing account display flag', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true, orderAmendmentsV1: true }}>
        <Probe />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('true:false:true');
  });
});
