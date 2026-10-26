import { HoldsSweeper } from '../services/holds-sweeper.service';
import { ReconciliacionService } from '../ecommerce/ordenes/reconciliacion.service';
import { activityGate, isProbePath } from './activity-gate';

const MIN = 60_000;

describe('activityGate', () => {
  afterEach(() => activityGate.reset());

  it('is active after a use and idle after the window passes', () => {
    activityGate.reset(Date.now() - 11 * MIN);
    expect(activityGate.isActive()).toBe(false);
    activityGate.touch();
    expect(activityGate.isActive()).toBe(true);
  });

  it('does not count health probes as use', () => {
    expect(isProbePath('/api/v1/health')).toBe(true);
    expect(isProbePath('/api/v1/health/live')).toBe(true);
    expect(isProbePath('/api/v1/mercados/ec')).toBe(false);
    expect(isProbePath('/api/v1/admin/observabilidad/health-check')).toBe(false);
  });
});

describe('background jobs and the activity gate', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    activityGate.reset();
  });

  it('the holds sweeper skips its tick while nobody uses the system and runs again after a visit', () => {
    const sweeper = new HoldsSweeper(undefined as never, undefined as never, undefined as never);
    const sweep = jest.spyOn(sweeper, 'sweep').mockResolvedValue(undefined);
    sweeper.onModuleInit();

    activityGate.reset(Date.now() - 30 * MIN);
    jest.advanceTimersByTime(6 * MIN);
    expect(sweep).not.toHaveBeenCalled();

    activityGate.touch();
    jest.advanceTimersByTime(5 * MIN);
    expect(sweep).toHaveBeenCalledTimes(1);
    sweeper.onModuleDestroy();
  });

  it('the reconciler does the same', () => {
    const reconciler = new ReconciliacionService(undefined as never, undefined as never, undefined as never, undefined as never);
    const reconciliar = jest.spyOn(reconciler, 'reconciliar').mockResolvedValue({ pagos: 0, anuncios: 0 });
    reconciler.onModuleInit();

    activityGate.reset(Date.now() - 30 * MIN);
    jest.advanceTimersByTime(6 * MIN);
    expect(reconciliar).not.toHaveBeenCalled();

    activityGate.touch();
    jest.advanceTimersByTime(5 * MIN);
    expect(reconciliar).toHaveBeenCalledTimes(1);
    reconciler.onModuleDestroy();
  });
});
