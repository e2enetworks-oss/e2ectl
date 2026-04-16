import { CliError } from '../../../src/core/errors.js';
import {
  buildNodeCatalogQuery,
  normalizeNodeCatalogBillingType,
  normalizeNodeCatalogPlanItems,
  normalizeOptionalNodeCatalogFamily,
  summarizeNodeCatalogPlans
} from '../../../src/node/catalog.js';
import type { NodeCatalogPlan } from '../../../src/node/types.js';

function samplePlan(overrides: Partial<NodeCatalogPlan> = {}): NodeCatalogPlan {
  const { specs: overrideSpecs = {}, ...planOverrides } = overrides;
  const basePlan: NodeCatalogPlan = {
    available_inventory_status: true,
    currency: 'INR',
    image: 'ubuntu-24.04',
    name: 'C3.8GB',
    plan: 'c3.large',
    specs: {
      committed_sku: [],
      cpu: 4,
      disk_space: 80,
      family: 'General Purpose',
      minimum_billing_amount: 0,
      price_per_hour: 8.5,
      price_per_month: 6100,
      ram: '8',
      series: 'C3',
      sku_name: 'C3.8GB'
    }
  };

  return {
    ...basePlan,
    ...planOverrides,
    specs: {
      ...basePlan.specs,
      ...overrideSpecs
    }
  };
}

describe('node catalog helpers', () => {
  it('builds a trimmed node catalog query', () => {
    expect(
      buildNodeCatalogQuery({
        category: '  compute  ',
        displayCategory: '  Linux  ',
        os: '  Ubuntu  ',
        osVersion: '  24.04  '
      })
    ).toEqual({
      category: 'compute',
      display_category: 'Linux',
      os: 'Ubuntu',
      osversion: '24.04'
    });
  });

  it('defaults billing type to all when unset', () => {
    expect(normalizeNodeCatalogBillingType(undefined)).toBe('all');
  });

  it('accepts explicit hourly and committed billing types', () => {
    expect(normalizeNodeCatalogBillingType('hourly')).toBe('hourly');
    expect(normalizeNodeCatalogBillingType('committed')).toBe('committed');
  });

  it('normalizes an optional family filter and rejects blank values', () => {
    expect(normalizeOptionalNodeCatalogFamily(undefined)).toBeUndefined();
    expect(normalizeOptionalNodeCatalogFamily('  GPU  ')).toBe('GPU');
    expect(() => normalizeOptionalNodeCatalogFamily('   ')).toThrow(CliError);
  });

  it('sorts plan items by config shape and preserves committed options for all billing', () => {
    const items = normalizeNodeCatalogPlanItems(
      [
        samplePlan({
          name: 'C3.16GB',
          plan: 'c3.xlarge',
          specs: {
            committed_sku: [
              {
                committed_days: 90,
                committed_sku_id: 91,
                committed_sku_name: '90 Days',
                committed_sku_price: 7800
              }
            ],
            cpu: 8,
            disk_space: 160,
            ram: '16',
            sku_name: 'C3.16GB'
          }
        }),
        samplePlan()
      ],
      'all'
    );

    expect(items.map((item) => item.sku)).toEqual(['C3.8GB', 'C3.16GB']);
    expect(items[0]?.committed_options).toEqual([]);
    expect(items[1]?.committed_options).toEqual([
      {
        days: 90,
        id: 91,
        name: '90 Days',
        total_price: 7800
      }
    ]);
  });

  it('drops committed options from hourly plan items', () => {
    const items = normalizeNodeCatalogPlanItems(
      [
        samplePlan({
          specs: {
            committed_sku: [
              {
                committed_days: 90,
                committed_sku_id: 91,
                committed_sku_name: '90 Days',
                committed_sku_price: 7800
              }
            ]
          }
        })
      ],
      'hourly'
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.committed_options).toEqual([]);
  });

  it('filters committed billing to plans that actually expose committed options', () => {
    const items = normalizeNodeCatalogPlanItems(
      [
        samplePlan(),
        samplePlan({
          name: 'gp-committed',
          plan: 'gp-committed',
          specs: {
            committed_sku: [
              {
                committed_days: 30,
                committed_sku_id: 31,
                committed_sku_name: '30 Days',
                committed_sku_price: 3000
              }
            ],
            sku_name: 'gp-committed'
          }
        })
      ],
      'committed'
    );

    expect(items.map((item) => item.sku)).toEqual(['gp-committed']);
  });

  it('filters plans by family before building plan items', () => {
    const items = normalizeNodeCatalogPlanItems(
      [
        samplePlan(),
        samplePlan({
          name: 'gpu-1',
          plan: 'gpu-1',
          specs: {
            family: 'GPU',
            sku_name: 'gpu-1'
          }
        })
      ],
      'all',
      'GPU'
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.config.family).toBe('GPU');
  });

  it('reports no-family-match when the requested family does not exist', () => {
    const summary = summarizeNodeCatalogPlans([samplePlan()], [], 'all', 'GPU');

    expect(summary).toEqual({
      available_families: ['General Purpose'],
      empty_reason: 'no_family_match'
    });
  });

  it('distinguishes no-committed and no-committed-for-family empty states', () => {
    expect(
      summarizeNodeCatalogPlans([samplePlan()], [], 'committed')
    ).toMatchObject({
      empty_reason: 'no_committed'
    });

    expect(
      summarizeNodeCatalogPlans(
        [samplePlan()],
        [],
        'committed',
        'General Purpose'
      )
    ).toMatchObject({
      empty_reason: 'no_committed_for_family'
    });
  });

  it('reports no-plans and exposes sorted unique available families', () => {
    const summary = summarizeNodeCatalogPlans(
      [
        samplePlan(),
        samplePlan({
          name: 'gpu-1',
          plan: 'gpu-1',
          specs: {
            family: 'GPU',
            sku_name: 'gpu-1'
          }
        }),
        samplePlan({
          name: 'blank-family',
          plan: 'blank-family',
          specs: {
            family: '   ',
            sku_name: 'blank-family'
          }
        })
      ],
      [],
      'all'
    );

    expect(summary).toEqual({
      available_families: ['General Purpose', 'GPU'],
      empty_reason: 'no_plans'
    });
  });
});
